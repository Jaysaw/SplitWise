from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Expense, ExpenseSplit, Settlement, Comment, ActivityLog
from .serializers import ExpenseSerializer, SettlementSerializer, CommentSerializer
from groups.models import Group

class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Allow filtering by group
        group_id = self.request.query_params.get('group')
        category_filter = self.request.query_params.get('category')
        
        queryset = Expense.objects.filter(group__members=self.request.user).distinct()
        
        if group_id:
            # Verify the user is a member of the group
            group = Group.objects.filter(id=group_id, members=self.request.user)
            if not group.exists():
                return Expense.objects.none()
            queryset = queryset.filter(group_id=group_id)
            
        if category_filter:
            queryset = queryset.filter(category=category_filter)
            
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        expense = serializer.save()
        ActivityLog.objects.create(
            group=expense.group,
            user=self.request.user,
            action_type='CREATE_EXPENSE',
            description=f"{self.request.user.full_name} added expense '{expense.description}' of ${expense.amount:.2f}"
        )

    def perform_update(self, serializer):
        expense = serializer.save()
        ActivityLog.objects.create(
            group=expense.group,
            user=self.request.user,
            action_type='UPDATE_EXPENSE',
            description=f"{self.request.user.full_name} updated expense '{expense.description}' to ${expense.amount:.2f}"
        )

    def perform_destroy(self, instance):
        group = instance.group
        desc = instance.description
        amt = instance.amount
        instance.delete()
        ActivityLog.objects.create(
            group=group,
            user=self.request.user,
            action_type='DELETE_EXPENSE',
            description=f"{self.request.user.full_name} deleted expense '{desc}' of ${amt:.2f}"
        )

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        expense = self.get_object()
        
        # Verify the user belongs to the group of this expense
        if not expense.group.members.filter(id=request.user.id).exists():
            return Response({"error": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
            
        if request.method == 'GET':
            comments = expense.comments.all().order_by('created_at')
            serializer = CommentSerializer(comments, many=True)
            return Response(serializer.data)
            
        elif request.method == 'POST':
            serializer = CommentSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(user=request.user, expense=expense)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SettlementViewSet(viewsets.ModelViewSet):
    serializer_class = SettlementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        group_id = self.request.query_params.get('group')
        if group_id:
            # Verify the user belongs to the group
            group = Group.objects.filter(id=group_id, members=self.request.user)
            if not group.exists():
                return Settlement.objects.none()
            return Settlement.objects.filter(group_id=group_id).order_by('-created_at')
        return Settlement.objects.filter(group__members=self.request.user).distinct().order_by('-created_at')

    def perform_create(self, serializer):
        settlement = serializer.save()
        ActivityLog.objects.create(
            group=settlement.group,
            user=self.request.user,
            action_type='RECORD_SETTLEMENT',
            description=f"{self.request.user.full_name} recorded a payment: {settlement.payer.full_name} paid {settlement.payee.full_name} ${settlement.amount:.2f}"
        )
