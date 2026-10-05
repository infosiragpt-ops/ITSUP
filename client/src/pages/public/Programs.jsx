import { useApi } from '../../lib/api.js';
import { ProgramsExplorer } from '../../components/programs.jsx';
import { Section } from './Home.jsx';

export default function Programs() {
  const { data: programs } = useApi('/public/programs');
  return (
    <>
      <div className="border-b border-line bg-sunken/60">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mb-3 text-xs font-bold tracking-[0.16em] text-primary uppercase">Oferta académica</div>
          <h1 className="font-display max-w-3xl text-[2.4rem] leading-[1.08] font-semibold text-ink sm:text-[3.2rem]">
            Carreras técnicas <em className="font-medium text-primary">100% virtuales</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
            Tres años, seis ciclos y un aula virtual que te acompaña de principio a fin. Al egresar obtienes el título de Profesional Técnico a nombre de la Nación.
          </p>
        </div>
      </div>
      <Section className="!pt-10 sm:!pt-14">
        <ProgramsExplorer programs={programs} />
      </Section>
    </>
  );
}
