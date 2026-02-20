import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
			<section className="relative py-20 px-6 text-center overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
				<div className="relative max-w-5xl mx-auto">
					<h1 className="text-6xl md:text-7xl font-black text-white [letter-spacing:-0.08em] mb-6">
						<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
							ERP System
						</span>
					</h1>
					<p className="text-2xl md:text-3xl text-gray-300 mb-4 font-light">
						Enterprise Resource Planning
					</p>
					<p className="text-lg text-gray-400 max-w-3xl mx-auto mb-8">
						A modern, AI-first ERP solution for managing your business operations.
					</p>
				</div>
			</section>
		</div>
	);
}
