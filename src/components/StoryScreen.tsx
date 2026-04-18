import { useStore } from '../store';
import { ChevronLeft, ChevronRight, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

const STORY_SCREENS = [
  {
    id: 1,
    bgPrompt: "beautiful green hills and fields with a shepherd tending sheep",
    text: "",
    buttons: ['start_intro', 'start_extra']
  },
  {
    id: 2,
    bgPrompt: "Hills of Judah at sunset, sheep grazing, small village in the distance, Bethlehem in miniature on the horizon, cinematic, highly detailed digital painting",
    text: "Era Davi, filho de Jessé, o belemita. Enquanto seus irmãos mais velhos treinavam para a guerra no exército do rei Saul, Davi passava seus dias nas colinas solitárias cuidando das ovelhas de seu pai.",
    buttons: ['prev', 'next']
  },
  {
    id: 3,
    bgPrompt: "Young David practicing with a sling. A stone flying towards a target on a tree. Dynamic angle, cinematic lighting, realistic",
    text: "Nessa solidão, ele desenvolveu uma precisão mortal com sua funda para afastar predadores e uma fé inabalável, compondo salmos com sua harpa sob as estrelas.",
    buttons: ['prev', 'next']
  },
  {
    id: 4,
    bgPrompt: "Rocky pasture. A large gray wolf with glowing eyes approaching the flock. Young David in defensive position with a sling in hand. Sheep getting scared in background. Dust rising, slightly cloudy sky, cinematic",
    text: "A vida no pasto exigia coragem. Um dia, um lobo feroz atacou o rebanho. Davi, confiante na proteção de Deus, enfrentou a fera para defender suas ovelhas.",
    buttons: ['prev', 'fight_wolf']
  },
  {
    id: 5,
    bgPrompt: "Starry night. Young David sitting on a rock, holding a rustic harp. Sheep sleeping around. Small campfire. Silver moonlight, starlight, cinematic",
    text: "Após vencer o lobo, Davi agradeceu a Deus. 'O Senhor é meu pastor', ele cantava. Mas a vida no deserto exigia vigilância constante.",
    buttons: ['next']
  },
  {
    id: 6,
    bgPrompt: "Rocky canyon with dry vegetation. A huge brown bear standing on hind legs, roaring. Young David with a stone in his sling, ready to swing. Rising sun creating dramatic silhouettes, bear with visible claws, cinematic",
    text: "Ao amanhecer, um urso colossal saiu da caverna e investiu contra o rebanho. A força do inimigo era aterrorizante, mas maior era a fé do pastor.",
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
    text: "Um leão poderoso surgiu das sombras. Diferente dos outros, este rugia com fúria. Davi soube que este era seu maior teste até então.",
    buttons: ['prev', 'fight_lion']
  },
  {
    id: 9,
    bgPrompt: "Golden sunset. Young David standing victorious over the defeated lion. Sun rays piercing through clouds, serene and confident expression, cinematic",
    text: "Parabéns, Davi! Você provou sua coragem e fé ao derrotar o leão. Uma passagem se abriu nas montanhas, siga a luz para voltar para casa.",
    buttons: ['walk_home']
  },
  {
    id: 10,
    bgPrompt: "Young David walking back home through a beautiful valley at sunset, carrying his staff and sling. Cinematic lighting, peaceful atmosphere",
    text: "Caminhando de volta para casa, Davi avistou uma figura familiar o esperando. Era o profeta Samuel, que havia viajado até Belém com um propósito divino.",
    buttons: ['next']
  },
  {
    id: 11,
    bgPrompt: "Prophet Samuel anointing young David with oil in a rustic house, biblical scene, cinematic lighting, masterpiece",
    text: "Deus via o coração do jovem pastor. Quando o profeta Samuel visitou sua casa, entre todos os filhos de Jessé, Deus escolheu o menor para ser o futuro rei de Israel, ungindo-o com óleo.",
    buttons: ['finish']
  },
  {
    id: 12,
    bgPrompt: "Valley of Elah. The Philistine army arrayed on a mountain on one side, Israel on the other. A towering giant warrior covered in bronze armor, Goliath, yelling challenges across the valley. Cinematic, epic, biblical scene",
    text: "E ajuntaram os filisteus os seus exércitos para a peleja no Vale de Elá. Saiu do arraial inimigo um homem guerreiro, cujo nome era Golias, que desafiava as fileiras de Israel dia e noite.",
    buttons: ['next']
  },
  {
    id: 13,
    bgPrompt: "Young David, a shepherd boy, arriving at the military camp of Israel, carrying provisions. He looks intensely at the giant Goliath in the distance. Cinematic, dramatic lighting, highly detailed",
    text: "Davi foi enviado por seu pai ao acampamento para levar mantimentos aos seus irmãos. Ao ouvir as afrontas do gigante, indignou-se: 'Quem é este incircunciso filisteu, para afrontar os exércitos do Deus vivo?'",
    buttons: ['prev', 'next'] 
  },
  {
    id: 14,
    bgPrompt: "Young shepherd David refusing King Saul's heavy bronze armor. David holding only his wooden staff, a shepherd's bag, and a simple sling. Epic dramatic lighting, biblical scene",
    text: "Levado ao rei Saul, Davi recusou as pesadas armaduras reais. 'Não posso andar com isto', disse ele. Tomou seu cajado, escolheu no ribeiro cinco seixos lisos e avançou com sua funda na mão.",
    buttons: ['prev', 'fight_philistines']
  },
  {
    id: 15,
    bgPrompt: "Epic victory scene, young David dropping his sling after defeating the giant Goliath, Israelites cheering in the background, cinematic lighting, masterpiece",
    text: "O gigante caiu! Com uma única pedra guiada por uma fé inabalável, Davi provou que 'do Senhor é a guerra'. O grande colosso foi derrubado e Israel celebrou a grande vitória!",
    buttons: ['prev', 'next']
  },
  {
    id: 16,
    bgPrompt: "King David wearing royal robes playing the harp in the palace of Jerusalem, peaceful atmosphere, warm cinematic lighting, epic conclusion, masterpiece",
    text: "PARABÉNS, JOGADOR! VOCÊ COMPLETOU A JORNADA!\n\nDe um simples pastor no campo ao maior rei da história de Israel, Davi nos ensina que, com Deus, nenhum gigante é invencível. A lenda do Rei Davi apenas começou...",
    buttons: ['finish']
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
    if (action === 'next' || action === 'start_intro') {
      setStoryScreen(storyScreen + 1);
    } else if (action === 'prev') {
      setStoryScreen(storyScreen - 1);
    } else if (action === 'fight_wolf') {
      startGame();
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        canvas?.requestPointerLock();
      }, 100);
    } else if (action === 'fight_bear' || action === 'fight_lion') {
      resumeGame();
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        canvas?.requestPointerLock();
      }, 100);
    } else if (action === 'jump_lion') {
      useStore.getState().jumpToPhase(3);
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        canvas?.requestPointerLock();
      }, 100);
    } else if (action === 'walk_home') {
      useStore.getState().startWalkingHome();
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        canvas?.requestPointerLock();
      }, 100);
    } else if (action === 'start_extra') {
      setStoryScreen(12);
    } else if (action === 'fight_philistines') {
      useStore.getState().startExtraGame();
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        canvas?.requestPointerLock();
      }, 100);
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

      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none">
        <div className="pointer-events-auto flex gap-4 items-end">
          {screenData.buttons.includes('prev') && (
            <button 
              onClick={() => handleAction('prev')}
              className="w-14 h-14 rounded-full bg-black/40 border-2 border-yellow-500 flex items-center justify-center text-white hover:bg-yellow-600/40 transition-all hover:scale-110 backdrop-blur-sm"
            >
              <ChevronLeft size={32} />
            </button>
          )}

          {screenData.buttons.includes('start_intro') && (
            <motion.button 
              onClick={() => handleAction('start_intro')}
              className="px-6 py-2.5 text-sm uppercase bg-yellow-600/80 border-2 border-yellow-400 rounded-full flex items-center gap-2 text-white font-bold hover:bg-yellow-500 backdrop-blur-sm shadow-[0_0_15px_rgba(234,179,8,0.5)] cursor-pointer"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              Iniciar o Jogo
              <ChevronRight size={20} />
            </motion.button>
          )}
        </div>

        <div className="pointer-events-auto flex gap-4 items-end">
          {screenData.buttons.includes('jump_bear') && (
            <button 
              onClick={() => handleAction('jump_bear')}
              className="px-6 py-3 bg-blue-900/80 border-2 border-blue-500 rounded-full flex items-center gap-3 text-white font-bold hover:bg-blue-800 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(59,130,246,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <ShieldAlert size={20} />
              FASE URSO
            </button>
          )}

          {screenData.buttons.includes('jump_lion') && (
            <button 
              onClick={() => handleAction('jump_lion')}
              className="px-6 py-3 bg-purple-900/80 border-2 border-purple-500 rounded-full flex items-center gap-3 text-white font-bold hover:bg-purple-800 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(168,85,247,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <ShieldAlert size={20} />
              FASE LEÃO
            </button>
          )}

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
              FINALIZAR JOGO
              <ArrowRight size={24} />
            </button>
          )}

          {screenData.buttons.includes('walk_home') && (
            <button 
              onClick={() => handleAction('walk_home')}
              className="px-8 py-3 bg-yellow-600/80 border-2 border-yellow-400 rounded-full flex items-center gap-3 text-white font-bold hover:bg-yellow-500 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(234,179,8,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              IR PARA CASA
              <ArrowRight size={24} />
            </button>
          )}

          {screenData.buttons.includes('start_extra') && (
            <motion.button 
              onClick={() => handleAction('start_extra')}
              className="px-6 py-2.5 text-sm uppercase bg-blue-600/80 border-2 border-blue-400 rounded-full flex items-center gap-2 text-white font-bold hover:bg-blue-500 backdrop-blur-sm shadow-[0_0_15px_rgba(37,99,235,0.5)] cursor-pointer"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, delay: 0.2, repeat: Infinity, ease: "easeInOut" }}
            >
              Modo Guerra
              <ChevronRight size={20} />
            </motion.button>
          )}

          {screenData.buttons.includes('fight_philistines') && (
            <button 
              onClick={() => handleAction('fight_philistines')}
              className="px-8 py-3 bg-red-900/80 border-2 border-red-500 rounded-full flex items-center gap-3 text-white font-bold hover:bg-red-800 transition-all hover:scale-105 backdrop-blur-sm shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <ShieldAlert size={24} />
              BATALHAR CONTRA FILISTEUS
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
