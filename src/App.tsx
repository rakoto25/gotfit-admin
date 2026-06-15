import { BrowserRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/Dashboard";
import User from "./pages/User";
import Annonce from "./pages/Annonce";
import Document from "./pages/Document";
import Reservation from "./pages/Reservation";
import Message from "./pages/Message";
import Payment from "./pages/Payment";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<User />} />
            <Route path="annonces" element={<Annonce />} />
            <Route path="documents" element={<Document />} />
            <Route path="reservations" element={<Reservation />} />
            <Route path="messages" element={<Message />} />
            <Route path="paiements" element={<Payment />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}