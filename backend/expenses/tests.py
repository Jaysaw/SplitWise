from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from groups.models import Group, GroupMembership
from expenses.models import Expense, ExpenseSplit, Settlement
from decimal import Decimal

User = get_user_model()

class SplitWiseTestCase(APITestCase):
    def setUp(self):
        # Create users
        self.user1 = User.objects.create_user(
            email='u1@example.com',
            username='user1',
            full_name='User One',
            password='password123'
        )
        self.user2 = User.objects.create_user(
            email='u2@example.com',
            username='user2',
            full_name='User Two',
            password='password123'
        )
        self.user3 = User.objects.create_user(
            email='u3@example.com',
            username='user3',
            full_name='User Three',
            password='password123'
        )

        # Authenticate user 1
        self.client.force_authenticate(user=self.user1)

        # Create a group
        self.group = Group.objects.create(name='Test Group', created_by=self.user1)
        GroupMembership.objects.create(group=self.group, user=self.user1)
        GroupMembership.objects.create(group=self.group, user=self.user2)
        GroupMembership.objects.create(group=self.group, user=self.user3)

    def test_equal_split_calculation(self):
        # Log expense of $30.00 paid by user1 equally split among 3 users
        url = f'/api/expenses/?group={self.group.id}'
        data = {
            "group": str(self.group.id),
            "description": "Pizza Party",
            "amount": "30.00",
            "paid_by_id": str(self.user1.id),
            "split_type": "EQUAL",
            "splits_input": [
                {"user_id": str(self.user1.id)},
                {"user_id": str(self.user2.id)},
                {"user_id": str(self.user3.id)}
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify split amounts are $10.00 each
        splits = ExpenseSplit.objects.all()
        self.assertEqual(splits.count(), 3)
        for split in splits:
            self.assertEqual(split.amount, Decimal('10.00'))

    def test_percentage_split_calculation(self):
        # Log expense of $100.00 paid by user 1, split 60% user 2, 40% user 3
        url = f'/api/expenses/?group={self.group.id}'
        data = {
            "group": str(self.group.id),
            "description": "Hotel Room",
            "amount": "100.00",
            "paid_by_id": str(self.user1.id),
            "split_type": "PERCENTAGE",
            "splits_input": [
                {"user_id": str(self.user2.id), "percentage": "60.00"},
                {"user_id": str(self.user3.id), "percentage": "40.00"}
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify splits
        split2 = ExpenseSplit.objects.get(user=self.user2)
        self.assertEqual(split2.amount, Decimal('60.00'))
        
        split3 = ExpenseSplit.objects.get(user=self.user3)
        self.assertEqual(split3.amount, Decimal('40.00'))

    def test_balances_endpoint(self):
        # User 1 pays $30.00 equally split among 3 users (each owes $10.00)
        url = f'/api/expenses/?group={self.group.id}'
        data = {
            "group": str(self.group.id),
            "description": "Breakfast",
            "amount": "30.00",
            "paid_by_id": str(self.user1.id),
            "split_type": "EQUAL",
            "splits_input": [
                {"user_id": str(self.user1.id)},
                {"user_id": str(self.user2.id)},
                {"user_id": str(self.user3.id)}
            ]
        }
        self.client.post(url, data, format='json')

        # Query balances
        balance_url = f'/api/groups/{self.group.id}/balances/'
        res = self.client.get(balance_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        balances = res.data['balances']
        b1 = next(b for b in balances if b['user']['id'] == str(self.user1.id))
        self.assertEqual(b1['net_balance'], 20.00)
        
        # Who owes whom check
        who_owes = res.data['who_owes_whom']
        self.assertEqual(len(who_owes), 2)
        
    def test_record_settlement(self):
        # User 2 records paying User 1 $10.00
        settle_url = f'/api/expenses/settlements/?group={self.group.id}'
        data = {
            "group": str(self.group.id),
            "payer_id": str(self.user2.id),
            "payee_id": str(self.user1.id),
            "amount": "10.00"
        }
        response = self.client.post(settle_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify settlement model exists
        self.assertEqual(Settlement.objects.count(), 1)
