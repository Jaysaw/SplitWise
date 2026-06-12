from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Expense, ExpenseSplit, Settlement, Comment, ActivityLog
from users.serializers import UserSerializer
from groups.models import Group

User = get_user_model()

class ExpenseSplitSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source='user.id')
    user = UserSerializer(read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ('user_id', 'user', 'amount', 'percentage', 'share')

class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'expense', 'user', 'content', 'created_at')
        read_only_fields = ('id', 'user', 'created_at')

class SettlementSerializer(serializers.ModelSerializer):
    payer = UserSerializer(read_only=True)
    payee = UserSerializer(read_only=True)
    payer_id = serializers.UUIDField(write_only=True)
    payee_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = Settlement
        fields = ('id', 'group', 'payer', 'payee', 'payer_id', 'payee_id', 'amount', 'created_at')
        read_only_fields = ('id', 'payer', 'payee', 'created_at')

    def create(self, validated_data):
        payer_id = validated_data.pop('payer_id')
        payee_id = validated_data.pop('payee_id')
        validated_data['payer'] = User.objects.get(id=payer_id)
        validated_data['payee'] = User.objects.get(id=payee_id)
        return super().create(validated_data)

class ExpenseSerializer(serializers.ModelSerializer):
    paid_by = UserSerializer(read_only=True)
    paid_by_id = serializers.UUIDField(write_only=True)
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    splits_input = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=True
    )

    class Meta:
        model = Expense
        fields = (
            'id', 'group', 'description', 'amount', 'paid_by', 
            'paid_by_id', 'split_type', 'category', 'splits', 'splits_input', 
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'splits', 'created_at', 'updated_at')

    def validate(self, attrs):
        amount = Decimal(str(attrs.get('amount', self.instance.amount if self.instance else 0)))
        split_type = attrs.get('split_type', self.instance.split_type if self.instance else 'EQUAL')
        splits_input = attrs.get('splits_input')
        
        if not splits_input:
            raise serializers.ValidationError({"splits_input": "Splits list is required."})

        # Pre-validate user existence
        user_ids = [s.get('user_id') for s in splits_input]
        users = User.objects.filter(id__in=user_ids)
        if len(users) != len(user_ids):
            raise serializers.ValidationError({"splits_input": "One or more user IDs do not exist."})

        calculated_splits = []

        if split_type == 'EQUAL':
            # Equal split: client sends list of user_ids. We divide amount by N.
            n = len(splits_input)
            if n == 0:
                raise serializers.ValidationError({"splits_input": "No users specified for split."})
            
            each_amount = (amount / n).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            # Sum up and find the difference due to rounding
            total_calc = each_amount * n
            diff = amount - total_calc
            
            for i, split in enumerate(splits_input):
                user_id = split.get('user_id')
                user_amount = each_amount
                # Add difference to the first person to balance sum perfectly
                if i == 0:
                    user_amount += diff
                
                calculated_splits.append({
                    'user_id': user_id,
                    'amount': user_amount,
                    'percentage': None,
                    'share': None
                })

        elif split_type == 'UNEQUAL':
            # Unequal split: client specifies amount for each user. Sum of amounts must match total.
            total_sum = Decimal('0.00')
            for split in splits_input:
                split_amount = Decimal(str(split.get('amount', 0)))
                total_sum += split_amount
                calculated_splits.append({
                    'user_id': split.get('user_id'),
                    'amount': split_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    'percentage': None,
                    'share': None
                })
            
            if total_sum != amount:
                raise serializers.ValidationError(
                    {"splits_input": f"Total splits sum (${total_sum}) must equal the total amount (${amount})."}
                )

        elif split_type == 'PERCENTAGE':
            # Percentage split: client specifies percentage for each user. Sum of percentages must equal 100.
            total_percent = Decimal('0.00')
            for split in splits_input:
                percent = Decimal(str(split.get('percentage', 0)))
                total_percent += percent

            if total_percent != Decimal('100.00'):
                raise serializers.ValidationError(
                    {"splits_input": f"Sum of percentages must equal 100% (got {total_percent}%)."}
                )

            # Calculate individual amounts and keep track of rounding diff
            total_calc = Decimal('0.00')
            temp_splits = []
            
            for split in splits_input:
                user_id = split.get('user_id')
                percent = Decimal(str(split.get('percentage', 0)))
                user_amount = (amount * percent / Decimal('100.00')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                total_calc += user_amount
                temp_splits.append({
                    'user_id': user_id,
                    'amount': user_amount,
                    'percentage': percent,
                    'share': None
                })

            diff = amount - total_calc
            if diff != 0 and temp_splits:
                # Add the remainder to the first split participant
                temp_splits[0]['amount'] += diff

            calculated_splits = temp_splits

        elif split_type == 'SHARE':
            # Share split: client specifies shares (e.g. 1, 2, 0.5) for each user.
            total_shares = Decimal('0.00')
            for split in splits_input:
                share = Decimal(str(split.get('share', 0)))
                total_shares += share

            if total_shares <= 0:
                raise serializers.ValidationError(
                    {"splits_input": f"Sum of shares must be greater than 0 (got {total_shares})."}
                )

            total_calc = Decimal('0.00')
            temp_splits = []
            
            for split in splits_input:
                user_id = split.get('user_id')
                share = Decimal(str(split.get('share', 0)))
                user_amount = (amount * share / total_shares).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                total_calc += user_amount
                temp_splits.append({
                    'user_id': user_id,
                    'amount': user_amount,
                    'percentage': None,
                    'share': share
                })

            diff = amount - total_calc
            if diff != 0 and temp_splits:
                # Add the remainder to the first split participant
                temp_splits[0]['amount'] += diff

            calculated_splits = temp_splits

        attrs['validated_splits'] = calculated_splits
        return attrs

    def create(self, validated_data):
        splits_input = validated_data.pop('splits_input')
        validated_splits = validated_data.pop('validated_splits')
        paid_by_id = validated_data.pop('paid_by_id')
        
        # Resolve foreign keys
        validated_data['paid_by'] = User.objects.get(id=paid_by_id)
        
        with transaction.atomic():
            expense = Expense.objects.create(**validated_data)
            for split in validated_splits:
                ExpenseSplit.objects.create(
                    expense=expense,
                    user_id=split['user_id'],
                    amount=split['amount'],
                    percentage=split['percentage'],
                    share=split['share']
                )
            
        return expense

    def update(self, instance, validated_data):
        splits_input = validated_data.pop('splits_input', None)
        validated_splits = validated_data.pop('validated_splits', None)
        paid_by_id = validated_data.pop('paid_by_id', None)
        
        if paid_by_id:
            validated_data['paid_by'] = User.objects.get(id=paid_by_id)
            
        with transaction.atomic():
            # Update expense fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            
            # Recreate splits if splits_input was supplied
            if validated_splits is not None:
                instance.splits.all().delete()
                for split in validated_splits:
                    ExpenseSplit.objects.create(
                        expense=instance,
                        user_id=split['user_id'],
                        amount=split['amount'],
                        percentage=split['percentage'],
                        share=split['share']
                    )
                    
        return instance

class ActivityLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = ('id', 'group', 'user', 'action_type', 'description', 'created_at')
        read_only_fields = ('id', 'user', 'created_at')
