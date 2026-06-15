import "../assets/css/reservation.css";

type ReservationItem = {
  id: number;
  client: string;
  coach: string;
  service: string;
  date: string;
  hour: string;
  status: "Confirmée" | "En attente" | "Annulée";
  price: string;
};

const reservations: ReservationItem[] = [
  {
    id: 1,
    client: "Jean Rakotondrasoa",
    coach: "Moussa",
    service: "Coaching personnel",
    date: "04/06/2026",
    hour: "10:00",
    status: "Confirmée",
    price: "35 €",
  },
  {
    id: 2,
    client: "Faniry",
    coach: "Sarah",
    service: "Yoga",
    date: "05/06/2026",
    hour: "14:30",
    status: "En attente",
    price: "25 €",
  },
  {
    id: 3,
    client: "Toky",
    coach: "Nina",
    service: "Fitness cardio",
    date: "06/06/2026",
    hour: "09:00",
    status: "Annulée",
    price: "30 €",
  },
];

export default function Reservation() {
  return (
    <div className="reservation-page">
      <div className="reservation-header">
        <div>
          <span className="reservation-eyebrow">Planning</span>
          <h1>Réservations</h1>
          <p>Gérez les réservations clients, les coachs et les statuts.</p>
        </div>

        <button className="reservation-add-btn">
          <span>+</span>
          Ajouter une réservation
        </button>
      </div>

      <div className="reservation-stats">
        <div className="reservation-stat-card">
          <span>Total réservations</span>
          <strong>{reservations.length}</strong>
        </div>

        <div className="reservation-stat-card">
          <span>Confirmées</span>
          <strong>
            {reservations.filter((item) => item.status === "Confirmée").length}
          </strong>
        </div>

        <div className="reservation-stat-card">
          <span>En attente</span>
          <strong>
            {reservations.filter((item) => item.status === "En attente").length}
          </strong>
        </div>

        <div className="reservation-stat-card">
          <span>Annulées</span>
          <strong>
            {reservations.filter((item) => item.status === "Annulée").length}
          </strong>
        </div>
      </div>

      <div className="reservation-toolbar">
        <div className="reservation-search">
          <span>⌕</span>
          <input type="text" placeholder="Rechercher une réservation..." />
        </div>

        <select className="reservation-filter">
          <option>Tous les statuts</option>
          <option>Confirmée</option>
          <option>En attente</option>
          <option>Annulée</option>
        </select>
      </div>

      <div className="reservation-table-card">
        <div className="table-responsive">
          <table className="reservation-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Coach</th>
                <th>Service</th>
                <th>Date</th>
                <th>Heure</th>
                <th>Prix</th>
                <th>Statut</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>

            <tbody>
              {reservations.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="reservation-user">
                      <div className="reservation-avatar">
                        {item.client.charAt(0)}
                      </div>

                      <div>
                        <strong>{item.client}</strong>
                        <span>RES-{String(item.id).padStart(4, "0")}</span>
                      </div>
                    </div>
                  </td>

                  <td>{item.coach}</td>
                  <td>{item.service}</td>
                  <td>{item.date}</td>
                  <td>{item.hour}</td>
                  <td>{item.price}</td>

                  <td>
                    <span
                      className={`reservation-status ${
                        item.status === "Confirmée"
                          ? "is-confirmed"
                          : item.status === "En attente"
                          ? "is-pending"
                          : "is-cancelled"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td>
                    <div className="reservation-actions">
                      <button>Voir</button>
                      <button>Valider</button>
                      <button className="danger">Annuler</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reservation-mobile-list">
        {reservations.map((item) => (
          <div className="reservation-mobile-card" key={item.id}>
            <div className="reservation-mobile-top">
              <div className="reservation-user">
                <div className="reservation-avatar">
                  {item.client.charAt(0)}
                </div>

                <div>
                  <strong>{item.client}</strong>
                  <span>{item.service}</span>
                </div>
              </div>

              <span
                className={`reservation-status ${
                  item.status === "Confirmée"
                    ? "is-confirmed"
                    : item.status === "En attente"
                    ? "is-pending"
                    : "is-cancelled"
                }`}
              >
                {item.status}
              </span>
            </div>

            <div className="reservation-mobile-meta">
              <span>Coach : {item.coach}</span>
              <span>Date : {item.date}</span>
              <span>Heure : {item.hour}</span>
              <span>Prix : {item.price}</span>
            </div>

            <div className="reservation-actions">
              <button>Voir</button>
              <button>Valider</button>
              <button className="danger">Annuler</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}