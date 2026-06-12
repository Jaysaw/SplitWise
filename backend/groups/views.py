from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from decimal import Decimal
from .models import Group, GroupMembership
from .serializers import GroupSerializer
from users.serializers import UserSerializer
from expenses.models import Expense, ExpenseSplit, Settlement, ActivityLog
from expenses.serializers import ActivityLogSerializer

User = get_user_model()

class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer

    def get_queryset(self):
        return Group.objects.filter(members=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        GroupMembership.objects.create(group=group, user=self.request.user)
        
        # Log group creation
        ActivityLog.objects.create(
            group=group,
            user=self.request.user,
            action_type='ADD_MEMBER',
            description=f"{self.request.user.full_name} created the group '{group.name}'."
        )

    @action(detail=True, methods=['post'])
    def members(self, request, pk=None):
        group = self.get_object()
        email = request.data.get('email')
        
        if not email:
            return Response({"email": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user_to_add = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User with this email does not exist."}, status=status.HTTP_404_NOT_FOUND)
            
        if group.members.filter(id=user_to_add.id).exists():
            return Response({"error": "User is already a member of this group."}, status=status.HTTP_400_BAD_REQUEST)
            
        GroupMembership.objects.create(group=group, user=user_to_add)
        
        # Log member addition
        ActivityLog.objects.create(
            group=group,
            user=self.request.user,
            action_type='ADD_MEMBER',
            description=f"{self.request.user.full_name} added {user_to_add.full_name} to the group."
        )
        
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='members/(?P<user_id>[^/.]+)')
    def remove_member(self, request, pk=None, user_id=None):
        group = self.get_object()
        user_to_remove = get_object_or_404(User, id=user_id)
        
        membership = GroupMembership.objects.filter(group=group, user=user_to_remove)
        if not membership.exists():
            return Response({"error": "User is not a member of this group."}, status=status.HTTP_400_BAD_REQUEST)
            
        net_balance = self._calculate_user_net_balance(group.id, user_to_remove)
        
        if abs(net_balance) >= Decimal('0.01'):
            return Response(
                {"error": f"Cannot remove member. User has a non-zero balance of ${net_balance:.2f}."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        membership.delete()
        
        # Log member removal
        ActivityLog.objects.create(
            group=group,
            user=self.request.user,
            action_type='REMOVE_MEMBER',
            description=f"{self.request.user.full_name} removed {user_to_remove.full_name} from the group."
        )
        
        return Response({"status": "Member removed successfully."}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def balances(self, request, pk=None):
        group = self.get_object()
        members = group.members.all()
        
        balances_list = []
        debtors = []
        creditors = []
        
        for member in members:
            net_val = self._calculate_user_net_balance(group.id, member)
            balances_list.append({
                "user": UserSerializer(member).data,
                "net_balance": float(net_val)
            })
            
            if net_val < -Decimal('0.005'):
                debtors.append([member, abs(net_val)])
            elif net_val > Decimal('0.005'):
                creditors.append([member, net_val])

        who_owes_whom = []
        debtors.sort(key=lambda x: x[1], reverse=True)
        creditors.sort(key=lambda x: x[1], reverse=True)
        
        i, j = 0, 0
        while i < len(debtors) and j < len(creditors):
            debtor_user, debt = debtors[i]
            creditor_user, credit = creditors[j]
            
            if debt < Decimal('0.005'):
                i += 1
                continue
            if credit < Decimal('0.005'):
                j += 1
                continue
                
            settle_amount = min(debt, credit)
            who_owes_whom.append({
                "from_user": UserSerializer(debtor_user).data,
                "to_user": UserSerializer(creditor_user).data,
                "amount": float(settle_amount.quantize(Decimal('0.01')))
            })
            
            debtors[i][1] -= settle_amount
            creditors[j][1] -= settle_amount
            
            if debtors[i][1] < Decimal('0.005'):
                i += 1
            if creditors[j][1] < Decimal('0.005'):
                j += 1

        return Response({
            "balances": balances_list,
            "who_owes_whom": who_owes_whom
        })

    @action(detail=True, methods=['get'])
    def activity(self, request, pk=None):
        group = self.get_object()
        logs = group.activities.all().order_by('-created_at')
        serializer = ActivityLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        group = self.get_object()
        categories = ['FOOD', 'RENT', 'UTILITIES', 'ENTERTAINMENT', 'TRAVEL', 'OTHER']
        stats = []
        for cat in categories:
            total = Expense.objects.filter(group=group, category=cat).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
            stats.append({
                "category": cat,
                "total": float(total)
            })
        return Response(stats)

    def _calculate_user_net_balance(self, group_id, user):
        lent = Expense.objects.filter(group_id=group_id, paid_by=user).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        owed = ExpenseSplit.objects.filter(expense__group_id=group_id, user=user).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        settlements_paid = Settlement.objects.filter(group_id=group_id, payer=user).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        settlements_received = Settlement.objects.filter(group_id=group_id, payee=user).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        return lent - owed + settlements_received - settlements_paid
