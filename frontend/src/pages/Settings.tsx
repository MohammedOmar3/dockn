import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const { user, logout, refresh } = useAuth()
  const { success, error } = useToast()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(user ? `${user.first_name} ${user.last_name}`.trim() : '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const updateProfile = useMutation({
    mutationFn: () => {
      const [first_name = '', ...rest] = displayName.trim().split(' ')
      return authApi.updateProfile({ first_name, last_name: rest.join(' ') })
    },
    onSuccess: async () => {
      await refresh()
      success('Profile updated')
    },
    onError: () => error('Failed to update profile'),
  })

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      success('Password changed')
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: () => error('Current password is incorrect'),
  })

  const deleteAccount = useMutation({
    mutationFn: () => authApi.deleteAccount({ password: deleteConfirm }),
    onSuccess: async () => {
      await logout()
      navigate('/login')
    },
    onError: () => error('Incorrect password'),
  })

  return (
    <div className="h-full overflow-auto">
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Profile */}
      <section className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Profile</h2>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email}</p>
        </div>
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            loading={updateProfile.isPending}
            disabled={!displayName.trim() || displayName.trim() === `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()}
            onClick={() => updateProfile.mutate()}
          >
            Save changes
          </Button>
        </div>
      </section>

      {/* Change password */}
      <section className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Change Password</h2>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
          hint="Minimum 8 characters"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            loading={changePassword.isPending}
            disabled={!currentPassword || newPassword.length < 8}
            onClick={() => changePassword.mutate()}
          >
            Update password
          </Button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-900 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!deleteModalOpen ? (
          <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
            Delete account
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              label="Enter your password to confirm"
              type="password"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Your password"
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteAccount.isPending}
                disabled={!deleteConfirm}
                onClick={() => deleteAccount.mutate()}
              >
                Permanently delete
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
    </div>
  )
}
