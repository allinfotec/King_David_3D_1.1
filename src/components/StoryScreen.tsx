import { useStore } from '../store';
import { ChevronLeft, ChevronRight, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

const STORY_SCREENS = [
  {
    id: 1,
    bgPrompt: "beautiful green hills and fields with a shepherd tending sheep",
    text: "",
    buttons: ['next']
  },
  {
    id: 2,
    bgPrompt: "Hills of Judah at sunset, sheep grazing, small village in the distance, Bethlehem in miniature on the horizon, cinematic, highly detailed digital painting",
    text: "Era Davi, filho de Jessé, o belemita, que estava no campo cuidando das ovelhas de seu pai. Enquanto pastoreava, Deus já observava o coração daquele jovem.",
    buttons: ['prev', 'next']
  },
  {
    id: 3,
    bgPrompt: "Inside Jesse's house in Bethlehem, rustic wooden door, simple interior with lit oil lamps. Elderly prophet Samuel holding a horn of oil. Young David kneeling, brown skin, short brown hair, simple tunic. Older brothers in background looking with admiration, cinematic lighting",
    text: "Voltando do campo, Davi encontrou o profeta Samuel em sua casa. Entre todos os filhos de Jessé, Deus escolheu o menor, o pastor, para ser o futuro rei de Israel. Samuel ungiu Davi com óleo na presença de seus irmãos.",
    buttons: ['prev', 'next']
  },
  {
    id: 4,
    bgPrompt: "Rocky pasture. A large gray wolf with glowing eyes approaching the flock. Young David in defensive position with a sling in hand. Sheep getting scared in background. Dust rising, slightly cloudy sky, cinematic",
    text: "De volta ao pasto, um lobo feroz atacou o rebanho. Davi, confiante na proteção de Deus, enfrentou a fera para defender suas ovelhas.",
    buttons: ['prev', 'fight_wolf']
  },
  {
    id: 5,
    bgPrompt: "Starry night. Young David sitting on a rock, holding a rustic harp. Sheep sleeping around. Small campfire. Silver moonlight, starlight, cinematic",
    text: "Após vencer o lobo, Davi agradeceu a Deus com sua harpa. 'O Senhor é meu pastor', ele cantava. Mas novos desafios viriam com o amanhecer.",
    buttons: ['next']
  },
  {
    id: 6,
    bgPrompt: "Rocky canyon with dry vegetation. A huge brown bear standing on hind legs, roaring. Young David with a stone in his sling, ready to swing. Rising sun creating dramatic silhouettes, bear with visible claws, cinematic",
    text: "Ao amanhecer, um urso saiu da caverna e investiu contra o rebanho. A força do inimigo era grande, mas maior era a fé do pastor.",
    buttons: ['prev', 'fight_bear']
  },
  {
    id: 7,
    bgPrompt: "Small waterfall in an oasis. Young David washing his face and drinking water. Sheep drinking from the stream. Crystal clear water, green vegetation, butterflies, cinematic",
    text: "Davi sabia que cada vitória vinha do Senhor. O mesmo Deus que o livrou das garras do lobo e do urso estaria com ele para sempre.",
    buttons: ['next']
  },
  {
    id: 8,
    bgPrompt: "Reddish twilight. A huge mountain lion with a massive mane about to attack. Young David running towards the lion without fear. Silhouette of the lion against the setting sun, determined expression on David, cinematic",
    text: "Um leão poderoso surgiu das sombras. Diferente dos outros, este rugia com fúria. Davi lembrou-se da unção de Samuel e soube que este era seu maior teste até então.",
    buttons: ['prev', 'fight_lion']
  },
  {
    id: 9,
    bgPrompt: "Golden sunset. Young David standing on top of a hill, safe flock behind him. His face is illuminated. Bodies of wolf, bear, and lion fallen in different parts of the landscape far away. Sun rays piercing through clouds, serene and confident expression, cinematic",
    text: "Lobo, urso e leão caíram diante do servo de Deus. O pastor estava preparado. Não apenas para cuidar de ovelhas, mas para enfrentar gigantes.",
    buttons: ['next']
  },
  {
    id: 10,
    bgPrompt: "Same hill as before, but David looks stronger. On the horizon, a Philistine army camped and a giant (Goliath) stands out. A messenger running towards David. Contrast between peaceful pasture and war camp in background, cinematic",
    text: "O rei Saul precisava de alguém para tocar harpa e acalmar seu coração. Mas Deus precisava de um guerreiro de fé. O pastor estava pronto para escrever a história.",
    buttons: ['prev', 'finish']
  }
];

export function StoryScreen() {
  const storyScreen = useStore((state) => state.storyScreen);
  const setStoryScreen = useStore((state) => state.setStoryScreen);
  const startGame = useStore((state) => state.startGame);
  const resumeGame = useStore((state) => state.resumeGame);
  const reset = useStore((state) => state.reset);

  if (storyScreen === 0) return null;

  const screenData = STORY_SCREENS.find(s => s.id === storyScreen);
  if (!screenData) return null;

  const handleAction = (action: string) => {
    if (action === 'next') {
      setStoryScreen(storyScreen + 1);
    } else if (action === 'prev') {
      setStoryScreen(storyScreen - 1);
    } else if (action === 'fight_wolf') {
      startGame();
      const canvas = document.querySelector('canvas');
      canvas?.requestPointerLock();
    } else if (action === 'fight_bear' || action === 'fight_lion') {
      resumeGame();
      const canvas = document.querySelector('canvas');
      canvas?.requestPointerLock();
    } else if (action === 'finish') {
      reset();
      window.location.reload();
    }
  };

  const bgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(screenData.bgPrompt)}?width=1920&height=1080&nologo=true`;

  return (
    <div 
      key={storyScreen}
      className="absolute inset-0 flex flex-col items-center justify-end z-50 bg-cover bg-center bg-no-repeat transition-all duration-1000 bg-slate-900"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.9) 100%), url("${bgUrl}")`
      }}
    >
      {storyScreen === 1 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <motion.span 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-white text-4xl md:text-6xl tracking-[0.4em] uppercase mb-[-2rem] z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "'Cinzel', serif", fontWeight: 600 }}
          >
            KING
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-[8rem] md:text-[16rem] text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] leading-none" 
            style={{ fontFamily: "'UnifrakturMaguntia', cursive" }}
          >
            David
          </motion.h1>
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-yellow-100/80 text-2xl md:text-4xl tracking-[0.3em] uppercase mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            A Origem
          </motion.span>
        </div>
      )}

      {screenData.text && (
        <div className="w-full max-w-4xl p-8 mb-12 bg-black/60 backdrop-blur-md border-t-2 border-b-2 border-yellow-600/50 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <p 
            className="text-white text-xl md:text-2xl leading-relaxed text-center drop-shadow-lg"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {screenData.text}
          </p>
        </div>
      )}

      <div className="absolute bottom-8 left-8 right-8 flex justify-between pointer-events-none">
        <div className="pointer-events-auto">
          {screenData.buttons.includes('prev') && (
            <button 
              onClick={() => handleAction('prev')}
              className="w-14 h-14 rounded-full bg-black/40 border-2 border-yellow-500 flex items-center justify-center text-white hover:bg-yellow-600/40 transition-all hover:scale-110 backdrop-blur-sm"
            >
              <ChevronLeft size={32} />
            </button>
          )}
        </div>

        <div className="pointer-events-auto flex gap-4">
          {screenData.buttons.includes('fight_wolf') && (
            <button 
              onClick={() => handleAction('fight_wolf')}
              className="px-8 py-3 bg-red-900/80 border-2 border-red-500 rounded-full flex items-center gap-3 text-white font-bold hover:bg-red-800 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <ShieldAlert size={24} />
              LUTAR CONTRA O LOBO
            </button>
          )}

          {screenData.buttons.includes('fight_bear') && (
            <button 
              onClick={() => handleAction('fight_bear')}
              className="px-8 py-3 bg-red-900/80 border-2 border-red-500 rounded-full flex items-center gap-3 text-white font-bold hover:bg-red-800 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <ShieldAlert size={24} />
              LUTAR CONTRA O URSO
            </button>
          )}

          {screenData.buttons.includes('fight_lion') && (
            <button 
              onClick={() => handleAction('fight_lion')}
              className="px-8 py-3 bg-red-900/80 border-2 border-red-500 rounded-full flex items-center gap-3 text-white font-bold hover:bg-red-800 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <ShieldAlert size={24} />
              LUTAR CONTRA O LEÃO
            </button>
          )}

          {screenData.buttons.includes('finish') && (
            <button 
              onClick={() => handleAction('finish')}
              className="px-8 py-3 bg-yellow-600/80 border-2 border-yellow-400 rounded-full flex items-center gap-3 text-white font-bold hover:bg-yellow-500 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(234,179,8,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              IR PARA A PRÓXIMA FASE
              <ArrowRight size={24} />
            </button>
          )}

          {screenData.buttons.includes('next') && (
            <button 
              onClick={() => handleAction('next')}
              className="w-14 h-14 rounded-full bg-black/40 border-2 border-yellow-500 flex items-center justify-center text-white hover:bg-yellow-600/40 transition-all hover:scale-110 backdrop-blur-sm"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
