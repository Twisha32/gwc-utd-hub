import { DotMatrix } from '@/components/DotMatrix';
import { HeroActions, UpcomingEvents } from '@/components/HomeClient';
import { activities, club } from '@/lib/club';

export default function Home() {
  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <h1>Build things together.</h1>
          <p className="hero-lede">
            {club.name} runs weekly workshops, career nights and a CTF ladder. RSVP to events,
            check in when you arrive and climb the board, all from one place.
          </p>
          <HeroActions />
        </div>
        <div className="hero-art">
          <DotMatrix />
        </div>
      </section>

      <UpcomingEvents />

      <section className="section" aria-labelledby="what-we-do" style={{ paddingBottom: 88 }}>
        <div className="section-head">
          <h2 id="what-we-do">What we do</h2>
        </div>
        <dl className="def-list">
          {activities.map((a) => (
            <div key={a.name}>
              <dt>{a.name}</dt>
              <dd>{a.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
