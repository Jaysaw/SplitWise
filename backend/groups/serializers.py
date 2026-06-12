from rest_framework import serializers
from .models import Group, GroupMembership
from users.serializers import UserSerializer

class GroupSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    members = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ('id', 'name', 'description', 'created_by', 'created_at', 'updated_at', 'members')
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at', 'members')
