'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CreateUserForm from './create-user-form';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'staff';
  created_at: string;
  onboarding_completed: boolean;
}

interface AdminUsersViewProps {
  users: User[];
}

export default function AdminUsersView({ users }: AdminUsersViewProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userList, setUserList] = useState(users);

  const handleUserCreated = (newUser: User) => {
    setUserList([newUser, ...userList]);
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-600 mt-2">Create and manage platform users</p>
      </div>

      {/* Create User Section */}
      <Card className="p-6">
        {!showCreateForm ? (
          <Button onClick={() => setShowCreateForm(true)} size="lg">
            + Create New User
          </Button>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Create New User</h2>
            <CreateUserForm
              onSuccess={handleUserCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}
      </Card>

      {/* Users List */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Active Users ({userList.length})</h2>

        {userList.length === 0 ? (
          <p className="text-slate-600">No users yet. Create one to get started.</p>
        ) : (
          <div className="space-y-3">
            {userList.map((user) => (
              <div
                key={user.id}
                className="p-4 rounded-lg border border-slate-200 flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{user.full_name}</p>
                  <p className="text-sm text-slate-600">{user.email}</p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        user.role === 'owner'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {user.role.toUpperCase()}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        user.onboarding_completed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {user.onboarding_completed ? 'Onboarded' : 'Pending Onboarding'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Created: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
