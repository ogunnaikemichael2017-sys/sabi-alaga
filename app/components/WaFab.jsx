const NUMBER = "2348089193663";

export default function WaFab() {
  return (
    <a
      className="wa"
      href={"https://wa.me/" + NUMBER + "?text=Hello%20Sabi%2C%20I%27d%20like%20to%20ask%20about%20my%20event."}
      aria-label="Chat on WhatsApp"
    >Chat on WhatsApp</a>
  );
}
