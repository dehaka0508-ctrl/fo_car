import { DatabaseStatus } from '@/components/sandbox/DatabaseStatus';
import { SimulationSandbox } from '@/components/sandbox/SimulationSandbox';

/** 엔진 단독 점검용 샌드박스 (한 시즌 자동 진행) + 구단 DB 현황 */
export default function SandboxPage() {
  return (
    <main className="flex flex-1 flex-col">
      <SimulationSandbox />
      <DatabaseStatus />
    </main>
  );
}
