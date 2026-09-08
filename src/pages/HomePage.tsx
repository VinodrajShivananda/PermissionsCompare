import { Link } from 'react-router-dom';
import { GitCompare, Shield, User, Users } from 'lucide-react';
import { useSalesforce } from '../auth/SalesforceContext';

const features = [
  {
    title: 'Compare Users',
    description: 'See effective permissions across profile, permission sets, and permission set groups.',
    icon: Users,
    to: '/compare/users',
  },
  {
    title: 'Compare Profiles',
    description: 'Diff object, field, system, and tab permissions between two profiles.',
    icon: Shield,
    to: '/compare/profiles',
  },
  {
    title: 'Compare Permission Sets',
    description: 'Identify permission differences between any two permission sets.',
    icon: GitCompare,
    to: '/compare/permission-sets',
  },
  {
    title: 'Compare Permission Set Groups',
    description: 'Compare member sets and combined permission footprint.',
    icon: User,
    to: '/compare/permission-set-groups',
  },
];

export function HomePage() {
  const { session } = useSalesforce();

  return (
    <div className="home-page">
      <section className="hero-section">
        <h1>Salesforce Permission Comparison</h1>
        <p className="subtitle" style={{ marginBottom: 0, textAlign: 'left' }}>
          {session
            ? `Connected to ${session.orgName} as ${session.displayName}. Select a comparison type below.`
            : 'Select a comparison type below to analyze permission differences in your org.'}
        </p>
      </section>

      <div className="card">
        <h2>Comparison Types</h2>
        <p className="hint">Click a type to start comparing permissions.</p>
        <div className="type-grid">
          {features.map((feature) => (
            <Link key={feature.to} to={feature.to} className="type-card">
              <feature.icon size={24} />
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
