from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet, SettlementViewSet

router = DefaultRouter()
router.register(r'settlements', SettlementViewSet, basename='settlement')
router.register(r'', ExpenseViewSet, basename='expense')

urlpatterns = [
    path('', include(router.urls)),
]
