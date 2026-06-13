import AICompanyShell from '@/components/ai-company/AICompanyShell';

export const metadata = { title: 'AI Company — SafeSquare' };

export default function AICompanyPage() {
  return (
    <div className="h-screen w-screen overflow-hidden" style={{ colorScheme: 'light' }}>
      <AICompanyShell />
    </div>
  );
}
