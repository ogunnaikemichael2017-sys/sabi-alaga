import AdminClient from "./AdminClient";

export const metadata = {
  title: "Admin | The Sabi Alaga",
  robots: { index: false, follow: false },
};

export default function Admin() {
  return <AdminClient />;
}
