import { useEffect, useState } from 'react'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { PageHeader } from '../../components/layout/PageHeader'
import { getAdminProfile } from '../../services/admin'
import type { AdminUser } from '../../types/user'

export function AdminProfile() {
  const [profile, setProfile] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setProfile(await getAdminProfile())
      setLoading(false)
    })()
  }, [])

  return (
    <div className="stack-gap">
      <PageHeader title="Admin Profile" live={false} />
      <Card title="Settings">
        {loading || !profile ? (
          <Loader />
        ) : (
          <>
            <p>
              <strong>Name:</strong> {profile.name}
            </p>
            <p>
              <strong>Email:</strong> {profile.email}
            </p>
            <p>
              <strong>Role:</strong> Website admin monitor
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
