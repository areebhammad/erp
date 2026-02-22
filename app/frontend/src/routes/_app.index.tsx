import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/')({ component: App });

function App() {
  return <div className="p-4">Home Page</div>;
}
