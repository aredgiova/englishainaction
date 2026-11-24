/** Source mapping and editorial decisions: docs/adventure-source/source-map.md. */
export type AdventureQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  feedback: string;
};

export type AdventureStep = {
  id: string;
  title: string;
  stage: string;
  instruction: string;
  paragraphs: string[];
  vocabulary?: { en: string; es: string }[];
  dialogue?: { speaker: string; text: string }[];
  questions?: AdventureQuestion[];
  listening?: { title: string; script: string };
  writing?: { label: string; placeholder: string; model: string };
  speaking?: { model: string; checklist: string[] };
};

export type AdventureMission = {
  id: "hello-explorer" | "my-world";
  number: number;
  title: string;
  place: string;
  subtitle: string;
  description: string;
  objective: string;
  level: "A1.1";
  image: string;
  imageAlt: string;
  reward: string;
  sourceNote: string;
  steps: AdventureStep[];
};

const question = (id: string, prompt: string, options: string[], answer: number, feedback: string): AdventureQuestion => ({ id, prompt, options, answer, feedback });

export const adventureMissions: AdventureMission[] = [
  {
    id: "hello-explorer",
    number: 1,
    title: "Hello, Explorer!",
    place: "Welcome Harbor",
    subtitle: "Tu primera palabra abre un nuevo mundo.",
    description: "El puerto ha perdido su sistema de bienvenida. Ayuda a Alex y a Byte a recuperar los saludos y las presentaciones para recibir a nuevos exploradores.",
    objective: "Saludar, presentarte y compartir información básica en inglés.",
    level: "A1.1",
    image: "/adventure/welcome-harbor.png",
    imageAlt: "Alex, con chaqueta azul y mochila roja, y Byte, un robot blanco y turquesa, saludan junto a un puerto con faro y barcos.",
    reward: "Welcome Explorer Badge + primera llave del mapa",
    sourceNote: "Basado en Mission 1 – Hello, Explorer!, versión 1.0: 14 pantallas. Las preguntas de selección adaptan los ejercicios del documento. El perfil final de Leo y la práctica explícita de preguntas y negaciones son complementos del prototipo. Hablar y escribir requieren revisión; completar el recorrido no certifica dominio del nivel.",
    steps: [
      {
        id: "adventure-begins",
        title: "The Adventure Begins",
        stage: "Historia",
        instruction: "Conoce a Alex. Escucha su presentación y prueba decir tu nombre.",
        paragraphs: [
          "WELCOME, EXPLORER! Your English adventure starts here. Are you ready to discover a new world?",
          "Bienvenido a The Discovery Islands. Tras The Great Silence, la red que conectaba sus comunidades dejó de funcionar. Cada misión recuperará una parte de la comunicación.",
          "Puedes practicar con tu nombre de explorador o con un personaje inventado. La edad y el lugar de origen siempre son opcionales.",
        ],
        dialogue: [
          { speaker: "Alex", text: "Hello! Welcome to the Discovery Islands!" },
          { speaker: "Alex", text: "My name is Alex. I’m a Global Explorer." },
          { speaker: "Alex", text: "What’s your name?" },
          { speaker: "You", text: "My name is…" },
          { speaker: "Alex", text: "Nice to meet you!" },
        ],
        speaking: { model: "Hello! My name is Alex. Nice to meet you!", checklist: ["Dije un saludo.", "Dije mi nombre o el de un personaje."] },
      },
      {
        id: "harbor-problem",
        title: "The Problem at the Harbor",
        stage: "Historia",
        instruction: "Descubre qué pasó en el puerto y cuál es tu misión.",
        paragraphs: [
          "ERROR: IDENTIFICATION SYSTEM OFFLINE.",
          "La estación de bienvenida no reconoce a los visitantes. Para repararla aprenderás saludos, conocerás a los exploradores y construirás una presentación.",
          "Tu recorrido: aprender → practicar → escuchar y leer → hablar y escribir → activar la estación. Puedes volver a cualquier actividad para practicar.",
        ],
        dialogue: [
          { speaker: "Alex", text: "Oh, no! The Welcome Station is not working. Visitors cannot introduce themselves." },
          { speaker: "Byte", text: "Communication system unavailable!" },
          { speaker: "Alex", text: "We need your help. Can you help us?" },
          { speaker: "Byte", text: "Don’t worry! You will learn how to say hello, introduce yourself and talk to other explorers." },
        ],
      },
      {
        id: "greeting-world",
        title: "Greeting the World",
        stage: "Explorar",
        instruction: "Aprende los saludos y elige una expresión para cada situación.",
        paragraphs: ["LOOK, LISTEN AND LEARN! Usa Good morning por la mañana, Good afternoon por la tarde y Good evening al saludar por la noche. Hello y Hi sirven para encontrarte con alguien. Goodbye y See you sirven para despedirte."],
        vocabulary: [
          { en: "Hello!", es: "¡Hola!" }, { en: "Hi!", es: "¡Hola! (informal)" },
          { en: "Good morning!", es: "¡Buenos días!" }, { en: "Good afternoon!", es: "¡Buenas tardes!" },
          { en: "Good evening!", es: "¡Buenas noches! (al saludar)" }, { en: "Goodbye!", es: "¡Adiós!" },
          { en: "Bye!", es: "¡Chao!" }, { en: "See you!", es: "¡Nos vemos!" },
          { en: "Thank you", es: "Gracias" }, { en: "Please", es: "Por favor" },
          { en: "Sorry", es: "Lo siento" }, { en: "Excuse me", es: "Disculpa / con permiso" },
          { en: "Nice to meet you", es: "Mucho gusto" }, { en: "Welcome", es: "Bienvenido/a" },
        ],
        questions: [
          question("morning", "You meet your teacher in the morning. What do you say?", ["Goodbye!", "Good morning!", "Good evening!"], 1, "Good morning se usa para saludar por la mañana."),
          question("friend", "You meet a friend. Choose the greeting.", ["Hi!", "Goodbye!", "See you!"], 0, "Hi es un saludo breve para un encuentro informal."),
          question("leaving", "You are leaving the harbor. What do you say?", ["Welcome!", "Good morning!", "Goodbye!"], 2, "Goodbye sirve para despedirte cuando te vas."),
          question("afternoon", "You meet someone in the afternoon. What do you say?", ["Good afternoon!", "Good morning!", "Bye!"], 0, "Good afternoon corresponde a un encuentro por la tarde."),
        ],
      },
      {
        id: "meet-explorers",
        title: "Meet the Explorers",
        stage: "Aprender",
        instruction: "Conoce al equipo. Completa cada frase con am, is o are.",
        paragraphs: [
          "I am Alex. You are a student. He is Alex. She is Mia. It is Byte. We are explorers. They are friends.",
          "Byte’s tip: use AM with I. Use IS with he, she and it. Use ARE with you, we and they.",
          "Las contracciones unen dos palabras: I am → I’m; you are → you’re; he is → he’s; she is → she’s; it is → it’s; we are → we’re; they are → they’re.",
        ],
        dialogue: [
          { speaker: "Alex · Explorer", text: "Hi! I’m Alex." },
          { speaker: "Mia · Inventor", text: "Hello! I’m Mia." },
          { speaker: "Byte · Robot", text: "Hi! I’m Byte." },
          { speaker: "Professor Nova · Mentor", text: "Good morning! I’m Professor Nova. We’re explorers!" },
        ],
        questions: [
          question("i-am", "I ___ Alex.", ["is", "am", "are"], 1, "I va con am: I am Alex."),
          question("she-is", "She ___ Mia.", ["are", "am", "is"], 2, "She va con is: She is Mia."),
          question("he-is", "He ___ a teacher.", ["is", "are", "am"], 0, "He va con is: He is a teacher."),
          question("we-are", "We ___ explorers.", ["am", "is", "are"], 2, "We va con are: We are explorers."),
          question("they-are", "They ___ friends.", ["are", "is", "am"], 0, "They va con are: They are friends."),
          question("it-is", "It ___ Byte.", ["are", "is", "am"], 1, "It va con is: It is Byte."),
        ],
      },
      {
        id: "ask-answer",
        title: "Ask and Answer",
        stage: "Aprender",
        instruction: "Construye un diálogo para conocer a alguien.",
        paragraphs: [
          "What’s your name? → My name is Mia. / I’m Mia.",
          "How are you? → I’m fine, thank you. / I’m great. / I’m OK. / I’m not very well.",
          "Nice to meet you! → Nice to meet you, too!",
          "Para preguntar con to be cambiamos el orden: She is Mia. → Is she Mia? Yes, she is. / No, she isn’t. Para negar añadimos not: I am not a teacher. She is not a robot.",
        ],
        dialogue: [
          { speaker: "Alex", text: "Hello! What’s your name?" },
          { speaker: "Mia", text: "My name is Mia." },
          { speaker: "Alex", text: "Nice to meet you!" },
          { speaker: "Mia", text: "Nice to meet you, too!" },
        ],
        questions: [
          question("dialogue-start", "Which line starts this conversation?", ["Nice to meet you, too!", "Hello! What’s your name?", "My name is Mia."], 1, "Primero saludamos y preguntamos el nombre; después respondemos y decimos Nice to meet you."),
          question("name-answer", "What’s your name?", ["I’m fine, thank you.", "Goodbye!", "My name is Mia."], 2, "My name is… responde a la pregunta por tu nombre."),
          question("wellbeing", "How are you?", ["I’m fine, thank you.", "My name is Alex.", "She is Mia."], 0, "How are you? pregunta cómo estás: I’m fine, thank you."),
          question("question-form", "Choose the question.", ["She is Mia.", "Is she Mia?", "She not Mia."], 1, "En la pregunta, is va antes de she: Is she Mia?"),
          question("negative", "Byte is a robot. Choose the true negative sentence.", ["Byte is not a robot.", "Byte are not a robot.", "Byte is not a teacher."], 2, "Byte es un robot, no un profesor: Byte is not a teacher."),
        ],
      },
      {
        id: "whos-who",
        title: "Who’s Who?",
        stage: "Practicar",
        instruction: "Escucha las presentaciones e identifica a cada personaje. Puedes repetir el audio.",
        paragraphs: ["Listen and identify the speaker. Fíjate en el nombre y en la ocupación. Si necesitas ayuda, escucha una vez más antes de consultar el texto."],
        listening: { title: "Four explorers", script: "One. Hello! My name is Mia. I’m an inventor. Two. Hi! I’m Alex. I’m an explorer. Three. Good morning! I’m Professor Nova. Four. Hello! I’m Byte. I’m a robot." },
        questions: [
          question("speaker-one", "Who is speaker 1?", ["Mia", "Alex", "Byte"], 0, "La primera presentación dice My name is Mia. I’m an inventor."),
          question("speaker-two", "Who is speaker 2?", ["Professor Nova", "Byte", "Alex"], 2, "La segunda voz se presenta como Alex, el explorador."),
          question("speaker-three", "Who is speaker 3?", ["Mia", "Professor Nova", "Alex"], 1, "La tercera presentación dice I’m Professor Nova."),
          question("speaker-four", "Who is speaker 4?", ["Byte", "Mia", "Professor Nova"], 0, "Byte se presenta como un robot: I’m Byte. I’m a robot."),
        ],
      },
      {
        id: "pronoun-detective",
        title: "Pronoun Detective",
        stage: "Practicar",
        instruction: "Sustituye el nombre de una persona, robot o grupo por el pronombre adecuado.",
        paragraphs: ["Mia → she. Alex → he. Byte, the robot → it. Alex and Mia → they. You and I → we. Recuerda: he/she/it + is; we/you/they + are."],
        questions: [
          question("mia", "___ is Mia.", ["He", "She", "They"], 1, "Para Mia usamos she: She is Mia."),
          question("alex", "___ is Alex.", ["He", "It", "We"], 0, "Para Alex usamos he: He is Alex."),
          question("group", "Alex and Mia are explorers. ___ are explorers.", ["We", "They", "She"], 1, "Hablamos de Alex y Mia: they. We incluiría a quien habla."),
          question("robot", "Byte is a robot. ___ is a robot.", ["They", "We", "It"], 2, "En este ejercicio usamos it para referirnos al robot."),
          question("friends", "They ___ friends.", ["are", "is", "am"], 0, "They va con are: They are friends."),
        ],
      },
      {
        id: "missing-word",
        title: "The Missing Word",
        stage: "Practicar",
        instruction: "Completa las frases para reparar la Welcome Station.",
        paragraphs: ["Complete the sentences to repair the Welcome Station. Byte’s reminder: I goes with AM! She goes with IS! We goes with ARE!"],
        questions: [
          question("student", "I ___ a student.", ["are", "am", "is"], 1, "I am a student. Con I usamos am."),
          question("friend", "She ___ my friend.", ["is", "are", "am"], 0, "She is my friend. Con she usamos is."),
          question("explorers", "We ___ explorers.", ["is", "am", "are"], 2, "We are explorers. Con we usamos are."),
          question("teacher", "He ___ a teacher.", ["are", "is", "am"], 1, "He is a teacher. Con he usamos is."),
          question("happy", "They ___ happy.", ["are", "am", "is"], 0, "They are happy. Con they usamos are."),
          question("robot", "It ___ a robot.", ["am", "are", "is"], 2, "It is a robot. Con it usamos is."),
        ],
      },
      {
        id: "listening-challenge",
        title: "Listening Challenge",
        stage: "Comprender",
        instruction: "Escucha dos conversaciones. Busca los nombres y cómo se sienten los personajes.",
        paragraphs: ["LISTEN CAREFULLY. En At the Harbor dos exploradores se conocen. En New Friends escuchas un saludo por la mañana. Intenta responder antes de abrir la transcripción; puedes consultarla siempre que la necesites."],
        listening: {
          title: "At the Harbor / New Friends",
          script: "At the Harbor. Alex: Hello! My name is Alex. What’s your name? Mia: Hi! I’m Mia. Alex: Nice to meet you, Mia. Mia: Nice to meet you, too! New Friends. Tom: Good morning! I’m Tom. Anna: Hello, Tom. I’m Anna. Tom: How are you? Anna: I’m fine, thank you. And you? Tom: I’m great!",
        },
        questions: [
          question("boy", "At the Harbor: What is the boy’s name?", ["Mike", "Alex", "Tom"], 1, "La conversación empieza con My name is Alex."),
          question("girl", "At the Harbor: What is the girl’s name?", ["Mia", "Anna", "Sara"], 0, "Ella se presenta con Hi! I’m Mia."),
          question("expression", "What expression does Alex use?", ["Goodbye", "Nice to meet you", "Good evening"], 1, "Alex dice Nice to meet you cuando conoce a Mia."),
          question("new-boy", "New Friends: What is the boy’s name?", ["Alex", "Daniel", "Tom"], 2, "La segunda conversación empieza con I’m Tom."),
          question("new-girl", "New Friends: What is the girl’s name?", ["Anna", "Mia", "Emma"], 0, "Ella dice I’m Anna."),
          question("anna", "How is Anna?", ["Not very well", "Fine", "Great"], 1, "Anna responde I’m fine, thank you."),
          question("tom", "How is Tom?", ["Great", "Not very well", "Sad"], 0, "Tom responde I’m great!"),
        ],
      },
      {
        id: "reading-challenge",
        title: "Reading Challenge",
        stage: "Comprender",
        instruction: "Lee los perfiles de los nuevos exploradores y responde.",
        paragraphs: [
          "Daniel: Hello! My name is Daniel. I’m 12 years old. I’m a student. I’m from Colombia. Nice to meet you!",
          "Emma: Hi! I’m Emma. I’m 13 years old. I’m from Canada. I’m a student. I’m happy to be here!",
          "Lucas: Good morning! My name is Lucas. I’m from Brazil. I’m an explorer. I’m happy to meet new friends.",
        ],
        vocabulary: [{ en: "name", es: "nombre" }, { en: "first name", es: "nombre de pila" }, { en: "last name", es: "apellido" }, { en: "age", es: "edad" }, { en: "country", es: "país" }, { en: "city", es: "ciudad" }, { en: "student", es: "estudiante" }, { en: "teacher", es: "docente" }, { en: "friend", es: "amigo/a" }],
        questions: [
          question("daniel-country", "Where is Daniel from?", ["Canada", "Brazil", "Colombia"], 2, "Daniel dice I’m from Colombia."),
          question("emma-student", "Is Emma a student?", ["Yes, she is.", "No, she isn’t.", "Yes, he is."], 0, "Emma dice I’m a student. Para responder sobre ella: Yes, she is."),
          question("lucas-role", "What is Lucas’s role?", ["Teacher", "Explorer", "Robot"], 1, "Lucas dice I’m an explorer."),
          question("daniel-canada", "Is Daniel from Canada?", ["Yes, he is.", "Yes, she is.", "No, he isn’t."], 2, "Daniel es de Colombia: No, he isn’t."),
          question("brazil", "Which explorer is from Brazil?", ["Lucas", "Emma", "Daniel"], 0, "Lucas dice I’m from Brazil."),
        ],
      },
      {
        id: "speaking-challenge",
        title: "Meet a New Friend",
        stage: "Comunicar",
        instruction: "Ahora habla tú. Presenta a un explorador real o imaginario en voz alta.",
        paragraphs: [
          "NOW IT’S YOUR TURN! Imagine you are meeting a new explorer. Introduce yourself.",
          "Empieza con un saludo, di un nombre y añade una frase con I’m. Edad y lugar son opcionales. Puedes usar información inventada.",
          "Primero escucha el modelo y luego inténtalo a tu ritmo. Esta práctica no graba tu voz ni emite una calificación de pronunciación.",
        ],
        speaking: {
          model: "Hello! My name is Alex. I’m a student. I’m from Colombia. Nice to meet you!",
          checklist: ["Usé un saludo.", "Presenté un nombre real o inventado.", "Usé I am o I’m.", "Mi mensaje se entiende.", "Cerré con Nice to meet you."],
        },
      },
      {
        id: "explorer-card",
        title: "My Explorer Card",
        stage: "Comunicar",
        instruction: "Crea tu presentación escrita. Puedes usar un personaje ficticio.",
        paragraphs: [
          "CREATE YOUR EXPLORER ID CARD! Incluye un saludo, un nombre, tu papel como student o explorer y una despedida amable.",
          "Revisa las mayúsculas, los puntos y la forma I’m. No necesitas compartir tu edad, país, ciudad ni otros datos personales.",
        ],
        writing: {
          label: "Tu presentación de explorador",
          placeholder: "Hello! My name is… I’m… Nice to meet you!",
          model: "Hello! My name is Alex. I’m a student. Nice to meet you!",
        },
      },
      {
        id: "activate-station",
        title: "Activate the Welcome Station",
        stage: "Misión final",
        instruction: "Integra lo aprendido: escucha, lee, habla y escribe.",
        paragraphs: [
          "The Welcome Station begins to glow. Byte: System partially restored! Alex: Excellent work! We are almost there. One final challenge. Are you ready?",
          "READ: Hello! My name is Leo. I’m a student. I’m from Peru. I’m happy to meet new friends. Nice to meet you!",
          "SPEAK: presenta un personaje con cuatro o cinco frases. WRITE: escribe su perfil. Puedes repetir y mejorar tu respuesta. Las preguntas comprueban comprensión; hablar y escribir son evidencias diferentes que puedes revisar con tu docente.",
        ],
        listening: { title: "The New Explorer", script: "Hello! I’m Sara. I’m a student. I’m from Mexico. Nice to meet you!" },
        questions: [
          question("sara-name", "LISTEN: What is her name?", ["Anna", "Sara", "Mia"], 1, "La exploradora se presenta con I’m Sara."),
          question("sara-country", "LISTEN: Where is Sara from?", ["Colombia", "Canada", "Mexico"], 2, "Sara dice I’m from Mexico."),
          question("sara-student", "LISTEN: Is Sara a student?", ["Yes, she is.", "No, she isn’t.", "Yes, he is."], 0, "Sara dice I’m a student; la respuesta es Yes, she is."),
          question("leo-name", "READ: What is the new explorer’s name?", ["Daniel", "Leo", "Lucas"], 1, "El nuevo perfil comienza My name is Leo."),
          question("leo-country", "READ: Where is Leo from?", ["Peru", "Brazil", "Mexico"], 0, "Leo dice I’m from Peru."),
          question("leo-role", "READ: Is Leo a teacher?", ["Yes, he is.", "Yes, she is.", "No, he isn’t."], 2, "Leo dice I’m a student. No es profesor: No, he isn’t."),
        ],
        speaking: { model: "Hello! My name is Leo. I’m an explorer. I’m from Peru. Nice to meet you!", checklist: ["Saludé.", "Me presenté con frases completas.", "Usé to be.", "Puedo repetir la presentación sin leer todo el modelo."] },
        writing: { label: "Perfil final del nuevo explorador", placeholder: "Hello! My name is…", model: "Hello! My name is Leo. I’m a student. I’m from Peru. Nice to meet you!" },
      },
      {
        id: "welcome-reward",
        title: "Welcome, Global Explorer!",
        stage: "Recompensa",
        instruction: "Celebra tu primera misión y piensa qué quieres seguir practicando.",
        paragraphs: [
          "The Welcome Station lights up. ¡El puerto vuelve a recibir exploradores! Has llegado al final del recorrido de práctica.",
          "Recibes Welcome Explorer Badge y la primera llave del mapa. Las ocho llaves de The Discovery Islands permitirán recuperar el Crystal of Identity.",
          "Reflexiona: ¿puedo saludar, decir mi nombre y entender una presentación? Vuelve a escuchar o practicar lo que necesites. Completar actividades no sustituye la valoración de tus habilidades.",
          "Your adventure continues in Mission 2: MY WORLD.",
        ],
        dialogue: [
          { speaker: "Alex", text: "You did it!" },
          { speaker: "Byte", text: "Communication system restored!" },
          { speaker: "Mia", text: "Welcome to the Global Explorers!" },
          { speaker: "Professor Nova", text: "This is only the beginning. There are seven more worlds to discover." },
        ],
      },
    ],
  },
  {
    id: "my-world",
    number: 2,
    title: "My World",
    place: "Explorer Village",
    subtitle: "Dale un nombre a todo lo que te rodea.",
    description: "Las etiquetas de la aldea han desaparecido. Explora con Mia, descubre objetos y ayuda a reconstruir el mapa de Explorer Village.",
    objective: "Identificar objetos y describir tu entorno con a/an y this, that, these, those.",
    level: "A1.1",
    image: "/adventure/explorer-village.png",
    imageAlt: "Aldea de exploradores con taller de inventos, biblioteca y plaza rodeada de vegetación tropical.",
    reward: "Village Explorer Badge + segunda llave del mapa",
    sourceNote: "Desarrollo inicial basado en Mission 2 – My World del Story Bible. Las 9 etapas, objetos, diálogos, lecturas y preguntas son contenido propuesto para completar el esquema del documento; deben revisarse con el programa aprobado de la Unidad 2.",
    steps: [
      {
        id: "village-arrival",
        title: "Welcome to Explorer Village",
        stage: "Historia",
        instruction: "Acompaña a Mia y descubre el problema de la aldea.",
        paragraphs: [
          "Explorer Village está llena de objetos, lugares y personas, pero sus pantallas perdieron las etiquetas. Nadie sabe dónde encontrar los materiales para la próxima expedición.",
          "Tu misión: reconocer objetos, usar a/an, distinguir lo cercano y lo lejano, y escribir una breve descripción. Al final reconstruirás la información del mapa.",
        ],
        dialogue: [
          { speaker: "Mia", text: "Hello, explorer! Welcome to my village." },
          { speaker: "Mia", text: "The labels are missing. Can you help me?" },
          { speaker: "Byte", text: "Let’s find the objects and learn their names!" },
        ],
      },
      {
        id: "object-lab",
        title: "The Object Lab",
        stage: "Explorar",
        instruction: "Aprende los nombres de los objetos del taller y de la aldea.",
        paragraphs: ["LOOK, LISTEN AND LEARN! What’s this? It’s a book. What are these? They’re pencils. Puedes usar estas preguntas para descubrir los nombres de las cosas."],
        vocabulary: [
          { en: "book", es: "libro" }, { en: "pencil", es: "lápiz" }, { en: "bag", es: "bolso / mochila" },
          { en: "chair", es: "silla" }, { en: "table", es: "mesa" }, { en: "map", es: "mapa" },
          { en: "apple", es: "manzana" }, { en: "umbrella", es: "paraguas" }, { en: "classroom", es: "salón de clase" },
          { en: "library", es: "biblioteca" }, { en: "workshop", es: "taller" }, { en: "village", es: "aldea" },
          { en: "big", es: "grande" }, { en: "small", es: "pequeño/a" }, { en: "red", es: "rojo/a" }, { en: "blue", es: "azul" },
        ],
        questions: [
          question("book", "Mia wants to read. Which object does she need?", ["A chair", "A book", "An umbrella"], 1, "Book significa libro: Mia puede leer un libro."),
          question("pencil", "Which word means lápiz?", ["Pencil", "Table", "Bag"], 0, "Pencil significa lápiz."),
          question("library", "Where can the explorers find many books?", ["In an umbrella", "In a pencil", "In the library"], 2, "Library significa biblioteca, un lugar para encontrar libros."),
        ],
      },
      {
        id: "a-or-an",
        title: "A Little Word, a Big Clue",
        stage: "Aprender",
        instruction: "Usa a o an para nombrar un objeto. Después descubre los plurales.",
        paragraphs: [
          "A book. A map. A chair. AN apple. AN umbrella. Elegimos a o an según el sonido inicial: a antes de un sonido consonántico y an antes de un sonido vocálico.",
          "Para varios objetos, estos ejemplos añaden -s: one book → two books; one pencil → three pencils. A/an se usa aquí con un solo objeto, no con plurales.",
          "What’s this? It’s a red bag. It’s a small book. En estas descripciones, el adjetivo va antes del nombre del objeto.",
        ],
        questions: [
          question("a-book", "It’s ___ book.", ["an", "a", "are"], 1, "Book empieza con sonido consonántico: a book."),
          question("an-apple", "It’s ___ apple.", ["a", "is", "an"], 2, "Apple empieza con sonido vocálico: an apple."),
          question("an-umbrella", "It’s ___ umbrella.", ["an", "a", "are"], 0, "Umbrella empieza con sonido vocálico: an umbrella."),
          question("plural", "One pencil. Three ___.", ["pencil", "pencils", "a pencil"], 1, "En este plural añadimos -s: three pencils."),
          question("adjective", "Choose the correct description.", ["It’s a bag red.", "It’s an red bag.", "It’s a red bag."], 2, "Red va antes de bag: a red bag."),
        ],
      },
      {
        id: "this-or-that",
        title: "This or That?",
        stage: "Aprender",
        instruction: "Observa la distancia y cuántos objetos hay. Cada pregunta te da las dos pistas.",
        paragraphs: [
          "THIS: un objeto cerca. THAT: un objeto lejos. THESE: varios objetos cerca. THOSE: varios objetos lejos.",
          "This is a book. That is a chair. These are pencils. Those are bags.",
          "What’s this? It’s a book. What are these? They’re pencils. Usa is para un objeto y are para varios.",
        ],
        questions: [
          question("this", "One book is here, in your hand. ___ is a book.", ["This", "Those", "These"], 0, "Un libro cerca: this. This is a book."),
          question("that", "One chair is far away, across the square. ___ is a chair.", ["These", "This", "That"], 2, "Una silla lejos: that. That is a chair."),
          question("these", "Three pencils are here, in your hand. ___ are pencils.", ["That", "These", "This"], 1, "Varios lápices cerca: these. These are pencils."),
          question("those", "Two bags are far away, across the square. ___ are bags.", ["Those", "This", "These"], 0, "Varios bolsos lejos: those. Those are bags."),
          question("question", "What are these? (Two books are near you.)", ["It’s a book.", "They’re books.", "It’s an apple."], 1, "Para varios objetos usamos They’re: They’re books."),
        ],
      },
      {
        id: "object-detective",
        title: "Object Detective",
        stage: "Practicar",
        instruction: "Escucha a Mia y encuentra los objetos que describe.",
        paragraphs: ["LISTEN AND LOCATE. Hay un libro, una mochila y varios lápices. Escucha los colores y si los objetos están cerca o lejos. Puedes volver a escuchar todas las veces que quieras."],
        listening: { title: "Mia’s workshop", script: "Hello! I’m Mia. This is my workshop. This is a small blue book. That is a big red bag. These are pencils. Those are chairs." },
        questions: [
          question("blue", "Which object is blue?", ["The bag", "The chair", "The book"], 2, "Mia dice a small blue book: el libro es azul."),
          question("red", "Which object is red?", ["The bag", "The book", "The pencil"], 0, "Mia dice a big red bag: la mochila es roja."),
          question("near", "Which objects are near Mia: these?", ["Chairs", "Pencils", "Bags"], 1, "Mia dice These are pencils. These indica varios objetos cercanos."),
          question("far", "Which objects are far from Mia: those?", ["Books", "Pencils", "Chairs"], 2, "Mia dice Those are chairs. Those indica varios objetos lejanos."),
        ],
      },
      {
        id: "label-village",
        title: "Label the Village",
        stage: "Comprender",
        instruction: "Lee la descripción y elige las etiquetas que corresponden a la escena.",
        paragraphs: [
          "READ: This is our classroom. This is a big table. These are three blue books. That is a small red bag near the door. Those are two chairs by the window.",
          "Busca una pista para cada etiqueta: nombre del objeto, color, tamaño o cantidad. Para reconocer los plurales, observa books y chairs.",
        ],
        questions: [
          question("place", "What place is described?", ["A classroom", "A harbor", "A café"], 0, "El texto empieza This is our classroom."),
          question("table-size", "Choose the table’s label.", ["Small table", "Blue bag", "Big table"], 2, "La mesa se describe como a big table."),
          question("books", "Choose the books’ label.", ["Two red books", "Three blue books", "One blue book"], 1, "El texto dice three blue books."),
          question("bag", "What is near the door?", ["A small red bag", "Three blue books", "A big umbrella"], 0, "La mochila pequeña y roja está near the door."),
          question("chairs", "How many chairs are there?", ["One", "Three", "Two"], 2, "El texto menciona two chairs by the window."),
        ],
      },
      {
        id: "whats-missing",
        title: "What’s Missing?",
        stage: "Practicar",
        instruction: "Compara el inventario anterior con el actual. Descubre qué falta.",
        paragraphs: [
          "BEFORE: a book, a pencil, a map, a bag.",
          "NOW: a book, a pencil, a bag.",
          "Byte guardó dos listas del taller. Una etiqueta desapareció. Encuentra el objeto que estaba en BEFORE pero ya no está en NOW. Después repasa las formas para uno y varios objetos.",
        ],
        questions: [
          question("missing", "What’s missing?", ["A pencil", "A map", "A bag"], 1, "A map aparece en BEFORE, pero no aparece en NOW."),
          question("name-it", "The missing object is in your hand now. Choose the sentence.", ["These is a map.", "Those are maps.", "This is a map."], 2, "Es un solo mapa y está cerca: This is a map."),
          question("plural-label", "Two books are near you. Choose their label.", ["These are books.", "This are book.", "That is books."], 0, "Dos libros cerca: These are books."),
        ],
      },
      {
        id: "my-place",
        title: "A Place of My Own",
        stage: "Comunicar",
        instruction: "Describe un salón, una habitación o un taller imaginario.",
        paragraphs: [
          "Elige tres objetos. Di qué son y añade un color o un tamaño. Usa al menos una frase con This is y otra con These are.",
          "Si hablas de algo lejos, usa That is o Those are. Puedes inventar todo el lugar; no necesitas describir tu casa ni indicar tu dirección.",
          "Compara tu texto con el modelo y vuelve a leerlo en voz alta. Una selección correcta no sustituye la producción de tus propias frases.",
        ],
        speaking: { model: "This is my classroom. This is a big table. These are blue books. That is a red bag.", checklist: ["Nombré un lugar y tres objetos.", "Distinguí uno y varios objetos.", "Usé this/these o that/those según la distancia.", "Añadí un color o tamaño."] },
        writing: { label: "Describe tu lugar de exploración", placeholder: "This is my… This is a… These are…", model: "This is my workshop. This is a small map. These are pencils. That is a blue bag." },
      },
      {
        id: "rebuild-map",
        title: "Rebuild the Village Map",
        stage: "Misión final",
        instruction: "Recupera las últimas etiquetas y completa tu descripción de la aldea.",
        paragraphs: [
          "READ: This is the library. This is a small table. These are red books here on the table. That is an umbrella over there by the door. Those are blue chairs over there by the window.",
          "Elige las etiquetas correctas y luego escribe tres o cuatro frases para tu propio espacio. Pronúncialas en voz alta; revisa si tu mensaje permite identificar cada objeto.",
          "Al terminar el recorrido recibirás Village Explorer Badge y la segunda llave del mapa. Puedes volver a cualquier etapa para practicar. Tu docente podrá revisar la descripción oral y escrita por separado.",
        ],
        questions: [
          question("place", "Which place needs its label?", ["Workshop", "Harbor", "Library"], 2, "La descripción empieza This is the library."),
          question("books", "The books are here, near you. ___ are red books.", ["These", "That", "This"], 0, "Son varios libros cerca: These are red books."),
          question("umbrella", "That is ___ umbrella.", ["a", "an", "are"], 1, "Umbrella comienza con sonido vocálico: an umbrella."),
          question("chairs", "The chairs are far away. ___ are blue chairs.", ["This", "These", "Those"], 2, "Varios objetos lejos: those. Those are blue chairs."),
          question("table", "Which description matches the reading?", ["This is a small table.", "This is a big map.", "These are small tables."], 0, "El texto describe una sola mesa pequeña: a small table."),
        ],
        speaking: { model: "This is the library. This is a small table. These are red books. Those are blue chairs.", checklist: ["Puedo identificar tres objetos.", "Puedo formular una pregunta con What’s this? o What are these?", "Puedo describir un lugar con frases propias."] },
        writing: { label: "Tu descripción final", placeholder: "This is… These are… That is…", model: "This is my classroom. This is a big table. These are blue books. That is a red bag." },
      },
    ],
  },
];
