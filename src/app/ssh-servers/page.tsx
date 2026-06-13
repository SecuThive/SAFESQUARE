import Sidebar from '@/components/layout/Sidebar';
import SshServersPage from '@/components/ssh/SshServersPage';

export default function SshServersRoute() {
  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SshServersPage />
      </main>
    </div>
  );
}
