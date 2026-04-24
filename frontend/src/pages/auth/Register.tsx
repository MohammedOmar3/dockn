import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function Register() {
  const { register } = useAuth()
  const { error, success } = useToast()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!displayName.trim()) e.displayName = 'Name is required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Must be at least 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (evt: FormEvent) => {
    evt.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const [first_name = '', ...rest] = displayName.trim().split(' ')
      await register({ first_name, last_name: rest.join(' '), email, password })
      success('Account created!')
      navigate('/', { replace: true })
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('409')) {
        error('An account with this email already exists')
      } else {
        error('Registration failed, please try again')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg">
            D
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
          Create account
        </h1>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-8">
          Get started with dockn
        </p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="Display name"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.displayName}
            placeholder="Your name"
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            placeholder="At least 8 characters"
            hint="Minimum 8 characters"
          />
          <Button type="submit" loading={loading} className="w-full mt-2">
            Create account
          </Button>
        </form>

        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
