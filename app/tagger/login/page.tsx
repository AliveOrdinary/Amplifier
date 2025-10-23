import LoginClient from '@/components/tagger/LoginClient'

export const metadata = {
  title: 'Login - Image Tagger',
  description: 'Sign in to access the image tagging system',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <LoginClient />
    </div>
  )
}
