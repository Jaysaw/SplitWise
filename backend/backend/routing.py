from django.urls import path
from expenses.consumers import ExpenseChatConsumer

websocket_urlpatterns = [
    path('ws/chat/expense/<str:expense_id>/', ExpenseChatConsumer.as_asgi()),
]
