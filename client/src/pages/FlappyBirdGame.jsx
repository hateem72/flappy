import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';

// Video schema for buildings
const VIDEO_SCHEMA = [
  { id: 1, src: '/gaurav.mp4', thumbnail: '/image.png' },
  { id: 2, src: '/gauravv.mp4', thumbnail: '/image.png' },
  { id: 3, src: '/krish.mp4', thumbnail: '/image.png' },
  { id: 4, src: '/arpit.mp4', thumbnail: '/image.png' },
  { id: 5, src: '/prakhar.mp4', thumbnail: '/image.png' },
  { id: 5, src: '/abhay.mp4', thumbnail: '/image.png' },
  { id: 5, src: '/yuvraj.mp4', thumbnail: '/image.png' },
  { id: 5, src: '/shivam.mp4', thumbnail: '/image.png' },
  { id: 5, src: '/vaibhav.mp4', thumbnail: '/image.png' },
];

// Bird photo schema
const BIRD_SCHEMA = [
  { id: 1, name: 'gaurav', photo: '/gaurav.png' },
  { id: 2, name: 'arpit', photo: '/arpit.png' },
  { id: 3, name: 'krish', photo: '/krish.png' },
  { id: 3, name: 'vaibhav', photo: '/vaibhav.png' },
  { id: 4, name: 'amrit', photo: '/amrit.png' },
];

// Audio schema
const AUDIO_SCHEMA = {
  background: '/music.mp3',  // Continuous background music
  collision: '/warn.mp3',     // Warning sound when hit
  gameOver: '/end.mp3'        // Game over music
};

const FlappyBirdGame = () => {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [birdPosition, setBirdPosition] = useState(250);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [obstacles, setObstacles] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(4);
  const [isShaking, setIsShaking] = useState(false);
  const [selectedBird, setSelectedBird] = useState(BIRD_SCHEMA[0]);
  const [showBirdSelection, setShowBirdSelection] = useState(false);
  
  const gameAreaRef = useRef(null);
  const backgroundMusicRef = useRef(null);
  const gameOverMusicRef = useRef(null);
  const collisionSoundRef = useRef(null);
  const birdVideoRef = useRef(null);
  const lastCollisionRef = useRef(0);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(Date.now());
  
  const controls = useAnimation();
  
  const GRAVITY = 0.3;
  const JUMP_STRENGTH = -9;
  const BIRD_SIZE = 50;
  const OBSTACLE_WIDTH = 100;
  const GAP_SIZE = 280;
  const OBSTACLE_SPEED = 2.5;

  // Get responsive dimensions
  const [gameWidth, setGameWidth] = useState(400);
  const [gameHeight, setGameHeight] = useState(600);

  useEffect(() => {
    const updateDimensions = () => {
      const width = Math.min(window.innerWidth, 500);
      const height = Math.min(window.innerHeight, 800);
      setGameWidth(width);
      setGameHeight(height);
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Preload all assets
  useEffect(() => {
    const preloadAssets = async () => {
      const messages = [
        '🔄 Connecting to server...',
        '⏳ Server is busy, please wait...',
        '🌐 Trying to reconnect you...',
        '📡 Almost there, hang tight...',
        '✨ Getting everything ready for you...',
      ];

      let messageIndex = 0;
      setLoadingMessage(messages[0]);
      setLoadingProgress(5);

      // Change messages periodically
      const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
      }, 2000);

      // Simulate server wake-up time
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoadingProgress(20);

      const totalAssets = BIRD_SCHEMA.length + VIDEO_SCHEMA.length + 4; // +4 for audios and result video
      let loadedAssets = 0;

      const updateProgress = () => {
        loadedAssets++;
        const progress = 20 + (loadedAssets / totalAssets) * 75;
        setLoadingProgress(Math.min(progress, 95));
      };

      // Preload bird images
      const birdPromises = BIRD_SCHEMA.map(bird => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            updateProgress();
            resolve();
          };
          img.onerror = () => {
            updateProgress();
            resolve();
          };
          img.src = bird.photo;
        });
      });

      await Promise.all(birdPromises);

      // Preload videos
      const videoPromises = VIDEO_SCHEMA.map(video => {
        return new Promise((resolve) => {
          const vid = document.createElement('video');
          vid.onloadeddata = () => {
            updateProgress();
            resolve();
          };
          vid.onerror = () => {
            updateProgress();
            resolve();
          };
          vid.src = video.src;
          vid.preload = 'auto';
        });
      });

      await Promise.all(videoPromises);

      // Preload result video
      await new Promise((resolve) => {
        const vid = document.createElement('video');
        vid.onloadeddata = () => {
          updateProgress();
          resolve();
        };
        vid.onerror = () => {
          updateProgress();
          resolve();
        };
        vid.src = '/amrit.mp4';
        vid.preload = 'auto';
      });

      // Preload audio files
      const audioPromises = Object.values(AUDIO_SCHEMA).map(audioSrc => {
        return new Promise((resolve) => {
          const audio = new Audio();
          audio.oncanplaythrough = () => {
            updateProgress();
            resolve();
          };
          audio.onerror = () => {
            updateProgress();
            resolve();
          };
          audio.src = audioSrc;
          audio.preload = 'auto';
        });
      });

      await Promise.all(audioPromises);

      clearInterval(messageInterval);
      
      // Final loading message
      setLoadingMessage('✅ Connected! Ready to play!');
      setLoadingProgress(100);
      
      // Small delay before hiding loader
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoading(false);
    };

    preloadAssets();
  }, []);

  // Smooth game loop using requestAnimationFrame
  useEffect(() => {
    if (gameStarted && !gameOver) {
      const gameLoop = () => {
        const currentTime = Date.now();
        const deltaTime = (currentTime - lastTimeRef.current) / 16.67; // Normalize to 60fps
        lastTimeRef.current = currentTime;

        // Update bird physics
        setBirdVelocity(v => v + (GRAVITY * deltaTime));
        setBirdPosition(pos => {
          const newPos = pos + (birdVelocity * deltaTime);
          if (newPos < 0) return 0;
          if (newPos > gameHeight - BIRD_SIZE) return gameHeight - BIRD_SIZE;
          return newPos;
        });

        // Update obstacles
        setObstacles(prev => {
          const newObstacles = prev
            .map(obs => ({ ...obs, x: obs.x - (OBSTACLE_SPEED * deltaTime) }))
            .filter(obs => obs.x > -(OBSTACLE_WIDTH + 200));
          
          if (newObstacles.length === 0 || newObstacles[newObstacles.length - 1].x < gameWidth - 350) {
            // Randomize gap position more dramatically
            const minGapTop = 50;
            const maxGapTop = gameHeight - GAP_SIZE - 50;
            const gapTop = Math.random() * (maxGapTop - minGapTop) + minGapTop;
            
            // DIFFERENT videos for top and bottom buildings
            const topVideo = VIDEO_SCHEMA[Math.floor(Math.random() * VIDEO_SCHEMA.length)];
            const bottomVideo = VIDEO_SCHEMA[Math.floor(Math.random() * VIDEO_SCHEMA.length)];
            
            // Random width variation for buildings
            const topWidth = OBSTACLE_WIDTH + (Math.random() * 50 - 25);
            const bottomWidth = OBSTACLE_WIDTH + (Math.random() * 50 - 25);
            
            // MUCH LARGER horizontal offset - top and bottom in VERY different positions
            const topOffset = Math.random() * 150 - 75;  // Range: -75 to +75
            const bottomOffset = Math.random() * 150 - 75;  // Range: -75 to +75
            
            newObstacles.push({
              x: gameWidth,
              gapTop,
              gapBottom: gapTop + GAP_SIZE,
              scored: false,
              topVideo: topVideo,
              bottomVideo: bottomVideo,
              id: Date.now(),
              topWidth: topWidth,
              bottomWidth: bottomWidth,
              topOffset: topOffset,
              bottomOffset: bottomOffset,
              topRotation: Math.random() * 8 - 4,
              bottomRotation: Math.random() * 8 - 4
            });
          }
          
          return newObstacles;
        });

        animationFrameRef.current = requestAnimationFrame(gameLoop);
      };

      lastTimeRef.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [gameStarted, gameOver, birdVelocity, gameWidth, gameHeight]);

  // Collision detection
  useEffect(() => {
    if (gameStarted && !gameOver) {
      const birdLeft = 50;
      const birdRight = birdLeft + BIRD_SIZE;
      const birdTop = birdPosition;
      const birdBottom = birdPosition + BIRD_SIZE;
      
      const currentTime = Date.now();
      
      obstacles.forEach(obs => {
        // Check collision with top building
        const topLeft = obs.x + (obs.topOffset || 0);
        const topRight = topLeft + (obs.topWidth || OBSTACLE_WIDTH);
        
        // Check collision with bottom building
        const bottomLeft = obs.x + (obs.bottomOffset || 0);
        const bottomRight = bottomLeft + (obs.bottomWidth || OBSTACLE_WIDTH);
        
        let hasCollision = false;
        
        // Check top building collision
        if (birdRight > topLeft && birdLeft < topRight && birdTop < obs.gapTop) {
          hasCollision = true;
        }
        
        // Check bottom building collision
        if (birdRight > bottomLeft && birdLeft < bottomRight && birdBottom > obs.gapBottom) {
          hasCollision = true;
        }
        
        if (hasCollision) {
          if (currentTime - lastCollisionRef.current > 1000 && !obs.collided) {
            obs.collided = true;
            handleCollision();
          }
        } else if (!obs.scored && birdLeft > Math.max(topRight, bottomRight)) {
          obs.scored = true;
          setScore(s => s + 1);
        }
      });
      
      if ((birdBottom >= gameHeight || birdTop <= 0) && currentTime - lastCollisionRef.current > 1000) {
        handleCollision();
      }
    }
  }, [birdPosition, obstacles, gameStarted, gameOver, gameHeight]);

  // Background music loop
  useEffect(() => {
    if (gameStarted && !gameOver && backgroundMusicRef.current) {
      // Reset and configure audio before playing
      backgroundMusicRef.current.currentTime = 0;
      backgroundMusicRef.current.loop = true;
      backgroundMusicRef.current.volume = 0.5;
      
      // Try to play with better error handling
      const playPromise = backgroundMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Background music started successfully");
          })
          .catch(error => {
            console.log("Audio play prevented:", error);
            // Try again after a short delay
            setTimeout(() => {
              if (backgroundMusicRef.current && gameStarted && !gameOver) {
                backgroundMusicRef.current.play().catch(() => {});
              }
            }, 100);
          });
      }
    } else if (backgroundMusicRef.current && !gameStarted) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
  }, [gameStarted, gameOver]);

  const handleCollision = useCallback(() => {
    lastCollisionRef.current = Date.now();
    
    // Play collision/warning sound
    if (collisionSoundRef.current) {
      collisionSoundRef.current.currentTime = 0;
      collisionSoundRef.current.volume = 0.7;
      const playPromise = collisionSoundRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Collision sound prevented:", error);
        });
      }
    }
    
    // Shake animation
    setIsShaking(true);
    controls.start({
      x: [0, -15, 15, -15, 15, 0],
      transition: { duration: 0.4 }
    });
    
    setTimeout(() => setIsShaking(false), 400);
    
    const newLives = lives - 1;
    setLives(newLives);
    
    if (newLives <= 0) {
      endGame();
    }
  }, [lives, controls]);

  const endGame = () => {
    setGameOver(true);
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
    if (gameOverMusicRef.current) {
      gameOverMusicRef.current.volume = 0.6;
      gameOverMusicRef.current.loop = true;
      const playPromise = gameOverMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Game over music prevented:", error);
        });
      }
    }
  };

  const handleJump = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
    }
    if (!gameOver) {
      setBirdVelocity(JUMP_STRENGTH);
    }
  }, [gameStarted, gameOver]);

  const restartGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setBirdPosition(gameHeight / 2);
    setBirdVelocity(0);
    setObstacles([]);
    setScore(0);
    setLives(4);
    lastCollisionRef.current = 0;
    
    // Stop game over music when restarting
    if (gameOverMusicRef.current) {
      gameOverMusicRef.current.pause();
      gameOverMusicRef.current.currentTime = 0;
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-500 via-yellow to-red-500 overflow-hidden">
        <div className="text-center p-8 max-w-md w-full">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-8"
          >
            <div className="w-24 h-24 mx-auto border-8 border-white border-t-transparent rounded-full shadow-2xl"></div>
          </motion.div>

          <motion.h1 
            className="text-5xl sm:text-6xl font-black mb-4 text-white"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)' }}
          >
            Flappy Friend
          </motion.h1>

          <p className="text-xl mb-6 text-white font-semibold" style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }}>
            {loadingMessage}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-white bg-opacity-30 rounded-full h-5 mb-4 overflow-hidden shadow-lg">
            <motion.div 
              className="h-full bg-white rounded-full shadow-inner"
              initial={{ width: 0 }}
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <p className="text-4xl font-bold mb-6 text-white" style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }}>
            {Math.round(loadingProgress)}%
          </p>

          <div className="bg-white bg-opacity-20 rounded-xl p-5 backdrop-blur-md shadow-xl border border-white border-opacity-30">
            <p className="text-base text-white font-semibold mb-2">⏳ Please wait...</p>
            <p className="text-sm text-white opacity-90">Server is engaged with other users</p>
            <p className="text-sm text-white opacity-90 mt-1">We'll connect you shortly!</p>
          </div>

          <motion.div
            className="mt-8 flex justify-center gap-3"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="w-4 h-4 bg-white rounded-full shadow-lg"></div>
            <div className="w-4 h-4 bg-white rounded-full shadow-lg"></div>
            <div className="w-4 h-4 bg-white rounded-full shadow-lg"></div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-sky-400 to-sky-200 overflow-hidden">
      <motion.div 
        className="relative w-full h-screen flex items-center justify-center"
        animate={controls}
        style={{ maxWidth: `${gameWidth}px` }}
      >
        {/* Game Area */}
        <div
          ref={gameAreaRef}
          className="relative bg-sky-300 overflow-hidden cursor-pointer shadow-2xl"
          style={{ 
            width: `${gameWidth}px`, 
            height: `${gameHeight}px`,
            touchAction: 'none',
            userSelect: 'none'
          }}
          onClick={(e) => {
            if (gameStarted && !gameOver) {
              handleJump();
            }
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            if (gameStarted && !gameOver) {
              handleJump();
            }
          }}
        >
          {/* Lives Display */}
          <div className="absolute top-3 left-3 z-50 flex gap-1.5">
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 1 }}
                animate={{ scale: i < lives ? 1 : 0.7 }}
                transition={{ duration: 0.3 }}
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 ${
                  i < lives ? 'bg-red-500 border-red-700' : 'bg-gray-400 border-gray-600'
                }`}
              >
                <span className="flex items-center justify-center h-full text-white font-bold text-sm sm:text-lg">
                  {i < lives ? '♥' : ''}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Score Display */}
          <div className="absolute top-3 right-3 z-50 bg-white bg-opacity-90 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-lg">
            <span className="text-xl sm:text-2xl font-bold text-gray-800">{score}</span>
          </div>

          {/* Bird (Photo) */}
          <motion.div
            className="absolute z-30 rounded-full overflow-hidden shadow-lg"
            style={{
              left: '50px',
              width: `${BIRD_SIZE}px`,
              height: `${BIRD_SIZE}px`,
            }}
            animate={{
              top: birdPosition,
              rotate: Math.min(Math.max(birdVelocity * 4, -30), 30)
            }}
            transition={{
              type: "tween",
              duration: 0.1,
              ease: "linear"
            }}
          >
            <img
              ref={birdVideoRef}
              src={selectedBird.photo}
              alt={selectedBird.name}
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Obstacles (Buildings with Videos) */}
          {obstacles.map(obs => (
            <div key={obs.id}>
              {/* Top Building */}
              <motion.div
                className="absolute bg-gradient-to-b from-gray-700 to-gray-600 border-4 border-gray-800 overflow-hidden"
                style={{
                  left: `${obs.x + (obs.topOffset || 0)}px`,
                  top: 0,
                  width: `${obs.topWidth || OBSTACLE_WIDTH}px`,
                  height: `${obs.gapTop}px`,
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                  transform: `rotate(${obs.topRotation || 0}deg)`,
                  transformOrigin: 'bottom center'
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <video
                  src={obs.topVideo.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-80"
                />
              </motion.div>
              
              {/* Bottom Building */}
              <motion.div
                className="absolute bg-gradient-to-t from-gray-700 to-gray-600 border-4 border-gray-800 overflow-hidden"
                style={{
                  left: `${obs.x + (obs.bottomOffset || 0)}px`,
                  top: `${obs.gapBottom}px`,
                  width: `${obs.bottomWidth || OBSTACLE_WIDTH}px`,
                  height: `${gameHeight - obs.gapBottom}px`,
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                  transform: `rotate(${obs.bottomRotation || 0}deg)`,
                  transformOrigin: 'top center'
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <video
                  src={obs.bottomVideo.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-80"
                />
              </motion.div>
            </div>
          ))}

          {/* Start Screen */}
          {!gameStarted && !gameOver && (
            <motion.div 
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-40 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div className="text-center text-white w-full max-w-md">
                <motion.h1 
                  className="text-4xl sm:text-5xl font-bold mb-8"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Flappy <span className="text-yellow-400 capitalize">{selectedBird.name}</span>
                </motion.h1>

                {!showBirdSelection ? (
                  <>
                    {/* Selected Bird Display */}
                    <div className="mb-8 flex flex-col items-center">
                      <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 backdrop-blur-sm shadow-2xl border-2 border-white">
                        <img 
                          src={selectedBird.photo} 
                          alt={selectedBird.name}
                          className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white shadow-lg"
                        />
                        <p className="font-bold text-lg capitalize">{selectedBird.name}</p>
                        <p className="text-xs opacity-80 mt-1">Your Champion</p>
                      </div>
                    </div>

                    {/* START GAME Button - HIGHLIGHTED */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setGameStarted(true);
                        // Enable audio on user interaction
                        if (backgroundMusicRef.current) {
                          backgroundMusicRef.current.load();
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setGameStarted(true);
                        // Enable audio on user interaction
                        if (backgroundMusicRef.current) {
                          backgroundMusicRef.current.load();
                        }
                      }}
                      className="relative bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-black py-4 px-12 rounded-2xl mb-4 text-2xl shadow-2xl border-4 border-white"
                      animate={{
                        scale: [1, 1.1, 1],
                        boxShadow: [
                          '0 0 20px rgba(34, 197, 94, 0.5)',
                          '0 0 40px rgba(34, 197, 94, 0.8)',
                          '0 0 20px rgba(34, 197, 94, 0.5)'
                        ]
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="drop-shadow-lg">▶ START GAME</span>
                    </motion.button>

                    {/* Change Bird Button */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBirdSelection(true);
                      }}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold py-2 px-6 rounded-lg mb-6 transition-colors border border-white"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      🔄 Change Character
                    </motion.button>

                    <div className="bg-black bg-opacity-30 rounded-lg p-3 backdrop-blur-sm">
                      <p className="text-sm sm:text-base opacity-90">👆 Tap to fly • 🏢 Avoid buildings</p>
                      <p className="text-sm sm:text-base opacity-90 mt-1">❤️ 4 Lives to survive!</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Bird Selection Screen */}
                    <p className="text-2xl mb-6 font-semibold">Select Your Bird</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {BIRD_SCHEMA.map((bird) => (
                        <motion.div
                          key={bird.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBird(bird);
                            setShowBirdSelection(false);
                          }}
                          className={`bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4 cursor-pointer border-2 ${
                            selectedBird.id === bird.id ? 'border-yellow-400' : 'border-transparent'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <img 
                            src={bird.photo} 
                            alt={bird.name}
                            className="w-16 h-16 rounded-full mx-auto mb-2"
                          />
                          <p className="font-semibold text-sm">{bird.name}</p>
                        </motion.div>
                      ))}
                    </div>

                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBirdSelection(false);
                      }}
                      className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Back
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* Game Over Screen */}
          {gameOver && (
            <motion.div 
              className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black bg-opacity-80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Score Above Video */}
              <motion.div 
                className="text-center mb-4"
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <h2 className="text-5xl sm:text-6xl font-black text-white mb-2" style={{ textShadow: '0 4px 8px rgba(0,0,0,0.8)' }}>
                  GAME OVER
                </h2>
                <p className="text-3xl sm:text-4xl font-bold text-yellow-400" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  Score: {score}
                </p>
              </motion.div>

              {/* Result Video */}
              <motion.div
                className="relative w-full max-w-md"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <video
                  src="/amrit.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto shadow-2xl"
                  style={{ maxHeight: '400px', objectFit: 'cover' }}
                />
              </motion.div>

              {/* Score Below Video */}
              <motion.div 
                className="text-center mt-4"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <p className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  Final Score: <span className="text-yellow-400">{score}</span>
                </p>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    restartGame();
                  }}
                  className="bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-bold py-3 px-10 rounded-xl text-xl shadow-2xl border-2 border-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(34, 197, 94, 0.5)',
                      '0 0 40px rgba(34, 197, 94, 0.8)',
                      '0 0 20px rgba(34, 197, 94, 0.5)'
                    ]
                  }}
                  transition={{
                    boxShadow: { duration: 1.5, repeat: Infinity }
                  }}
                >
                  🔄 Play Again
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Audio Elements */}
      <audio ref={backgroundMusicRef} src={AUDIO_SCHEMA.background} preload="auto" />
      <audio ref={gameOverMusicRef} src={AUDIO_SCHEMA.gameOver} preload="auto" />
      <audio ref={collisionSoundRef} src={AUDIO_SCHEMA.collision} preload="auto" />
    </div>
  );
};

export default FlappyBirdGame;
