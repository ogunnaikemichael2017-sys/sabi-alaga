import Curtain from "./components/Curtain";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Services from "./components/Services";
import Weddings from "./components/Weddings";
import About from "./components/About";
import Testimonials from "./components/Testimonials";
import Training from "./components/Training";
import Booking from "./components/Booking";
import Footer from "./components/Footer";
import WaFab from "./components/WaFab";
import MotionEffects from "./components/MotionEffects";

export default function Page() {
  return (
    <>
      <Curtain />
      <Hero />
      <Marquee />
      <Services />
      <Weddings />
      <About />
      <Testimonials />
      <Training />
      <Booking />
      <Footer />
      <WaFab />
      <MotionEffects />
    </>
  );
}
