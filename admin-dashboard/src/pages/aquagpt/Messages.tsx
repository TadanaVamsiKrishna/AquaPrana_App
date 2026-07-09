import { Card } from '../../components/common/Card'
import { PageHeader } from '../../components/layout/PageHeader'

export function Messages() {
  return (
    <div className="stack-gap">
      <PageHeader title="AquaGPT Messages" live={false} />
      <Card title="Messages">
        <div className="empty-state">Message transcript view coming soon.</div>
      </Card>
    </div>
  )
}
