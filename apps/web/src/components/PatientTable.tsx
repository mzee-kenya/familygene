import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Patient } from '../data/types';
import { StatusBadge } from './StatusBadge';

export function PatientTable({
  patients,
  compact = false,
}: {
  patients: Patient[];
  compact?: boolean;
}) {
  return (
    <div className="table-responsive">
      <table className={`data-table${compact ? ' data-table--compact' : ''}`}>
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Age</th>
            {!compact && <th scope="col">Registered</th>}
            <th scope="col">Family history</th>
            <th scope="col">Review</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id}>
              <td>
                <Link className="patient-cell" to={`/patients/${patient.id}`}>
                  <span className="patient-avatar" aria-hidden="true">
                    {patient.name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')}
                  </span>
                  <span>
                    <strong>{patient.name}</strong>
                    <small>{patient.id}</small>
                  </span>
                </Link>
              </td>
              <td>{patient.age}</td>
              {!compact && <td>{patient.registeredAt}</td>}
              <td>
                <StatusBadge value={patient.familyHistory} />
              </td>
              <td>
                <StatusBadge value={patient.reviewStatus} />
              </td>
              <td>
                <Link
                  aria-label={`View ${patient.name}`}
                  className="table-action"
                  to={`/patients/${patient.id}`}
                >
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
