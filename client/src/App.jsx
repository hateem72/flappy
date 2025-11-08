import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FlappyBirdGame from './pages/FlappyBirdGame';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FlappyBirdGame />} />
      </Routes>
    </Router>
  );
};

export default App;
