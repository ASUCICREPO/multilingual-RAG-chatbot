import Header from './components/Header';
import Hero from './components/Hero';
import ContentCards from './components/ContentCards';
import FeedbackWidget from './components/FeedbackWidget';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <ContentCards />
      <FeedbackWidget />
    </div>
  );
}
