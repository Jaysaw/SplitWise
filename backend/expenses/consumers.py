from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Expense, Comment

User = get_user_model()

class ExpenseChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.expense_id = self.scope['url_route']['kwargs']['expense_id']
        self.group_name = f"expense_chat_{self.expense_id}"
        self.user = self.scope.get('user')

        # Check authentication
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4003)  # Forbidden / Unauthorized
            return

        # Check if user is a member of the group that owns this expense
        is_member = await self.check_group_membership(self.expense_id, self.user)
        if not is_member:
            await self.close(code=4003)
            return

        # Add connection to group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive_json(self, content):
        message_text = content.get('content')
        if not message_text or not message_text.strip():
            return

        # Persist comment to database
        comment_data = await self.save_comment(self.expense_id, self.user, message_text)
        
        # Broadcast comment to channels group
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'chat_message',
                'comment': comment_data
            }
        )

    async def chat_message(self, event):
        # Forward group broadcast to the WebSocket client
        await self.send_json(event['comment'])

    @database_sync_to_async
    def check_group_membership(self, expense_id, user):
        try:
            expense = Expense.objects.get(id=expense_id)
            return expense.group.members.filter(id=user.id).exists()
        except Expense.DoesNotExist:
            return False

    @database_sync_to_async
    def save_comment(self, expense_id, user, text):
        comment = Comment.objects.create(
            expense_id=expense_id,
            user=user,
            content=text
        )
        return {
            'id': str(comment.id),
            'expense_id': str(comment.expense.id),
            'user': {
                'id': str(comment.user.id),
                'full_name': comment.user.full_name,
                'email': comment.user.email,
                'avatar_url': comment.user.avatar_url
            },
            'content': comment.content,
            'created_at': comment.created_at.isoformat()
        }
