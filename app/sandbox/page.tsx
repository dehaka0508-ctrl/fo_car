import { SimulationSandbox } from '@/components/sandbox/SimulationSandbox';

/** 엔진 단독 점검용 샌드박스 (한 시즌 자동 진행) */
export default function SandboxPage() {
  return (
    <main className="flex flex-1 flex-col">
      <SimulationSandbox />
    </main>
  );
}
