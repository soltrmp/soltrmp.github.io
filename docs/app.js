document.addEventListener('DOMContentLoaded', function() {
  // Variables globales
  let flashcards = [];
  let currentFlashcardIndex = 0;
  let currentBoxNumber = 1;
  let currentDeck = '';
  
  // Intervalles de révision en heures
  const reviewIntervals = [1, 3, 9, 27, 81];
  
  // Éléments du DOM
  const accordionBtn = document.querySelector('.accordion-btn');
  const accordionContent = document.querySelector('.accordion-content');
  const boxes = document.querySelectorAll('.box');
  const boxCounters = document.querySelectorAll('.box-counter');
  const boxNextReviews = document.querySelectorAll('.box-next-review');
  const flashcardContainer = document.getElementById('flashcard-container');
  const questionContent = document.getElementById('question-content');
  const answerContent = document.getElementById('answer-content');
  const lastReviewed = document.getElementById('last-reviewed');
  const showAnswerBtn = document.getElementById('show-answer-btn');
  const answerSection = document.getElementById('answer-section');
  const wrongAnswerBtn = document.getElementById('wrong-answer');
  const rightAnswerBtn = document.getElementById('right-answer');
  const resetBtn = document.getElementById('reset-btn');
  const startBtn = document.getElementById('start-btn');
  const deckSelector = document.getElementById('deck-selector');
  const cardsListContainer = document.getElementById('cards-list-container');
  const cardsList = document.getElementById('cards-list');
  const cardsListTitle = document.getElementById('cards-list-title');
  
  // Fonction pour mettre à jour les temps de révision
  function updateNextReviewTimes() {
      boxes.forEach((box, index) => {
          const boxNumber = index + 1;
          const nextReview = getNextReviewTime(boxNumber);
          boxNextReviews[index].textContent = nextReview 
              ? `Prochaine rev.: ${formatTime(nextReview)}` 
              : '';
      });
  }

  function loadCSVFiles() {
    // Fichier par défaut
    const defaultOption = document.createElement('option');
    defaultOption.value = 'flashcards.csv';
    defaultOption.textContent = 'Flashcards par défaut';
    deckSelector.appendChild(defaultOption);

    // Récupérer les autres fichiers CSV dynamiquement depuis GitHub
    fetch('https://api.github.com/repos/soltrmp/soltrmp.github.io/contents/docs')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur réseau');
            }
            return response.json();
        })
        .then(files => {
            const csvFiles = files.filter(file => 
                file.name.endsWith('.csv') && 
                file.name !== 'flashcards.csv' &&
                file.type === 'file'
            );
            
            if (csvFiles.length === 0) {
                deckSelector.firstChild.textContent = 'Aucun fichier CSV trouvé';
                return;
            }
            
            csvFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = `${file.name}`; // Chemin relatif depuis la racine
                option.textContent = file.name.replace('.csv', '');
                deckSelector.appendChild(option);
            });

            startBtn.disabled = false;
            deckSelector.firstChild.textContent = 'Sélectionnez un jeu';
        })
        .catch(error => {
            console.error('Erreur de chargement des fichiers CSV:', error);
            deckSelector.firstChild.textContent = 'Erreur de chargement - Utilisez flashcards.csv';
            startBtn.disabled = false;
        });
}
  
  // Charger les flashcards
  function loadFlashcards(deckFile) {
    // Ajoutez cette ligne pour debugger
    console.log('Chargement du fichier:', deckFile);
      fetch(deckFile)
          .then(response => response.text())
          .then(data => {
              const lines = data.split('\n').filter(line => line.trim() !== '');
              if (lines.length < 2) {
                  throw new Error('Fichier CSV vide ou mal formaté');
              }
              
              flashcards = [];
              const headers = lines[0].split(',').map(h => h.trim());
              
              for (let i = 1; i < lines.length; i++) {
                  const values = parseCSVLine(lines[i]);
                  if (values.length === 0) continue;
                  
                  const card = {
                      question: values[0] ? values[0].trim() : '',
                      questionImage: values[1] ? values[1].trim() : '',
                      answer: values[2] ? values[2].trim() : '',
                      answerImage: values[3] ? values[3].trim() : '',
                      box: parseInt(values[4]) || 1,
                      lastReview: values[5] ? new Date(values[5]).getTime() || Date.now() : Date.now()
                  };
                  
                  flashcards.push(card);
              }
              
              // Charger depuis localStorage
              const savedFlashcards = localStorage.getItem('leitnerFlashcards');
              if (savedFlashcards) {
                  try {
                      const parsed = JSON.parse(savedFlashcards);
                      flashcards = flashcards.map(card => {
                          const savedCard = parsed.find(c => 
                              c.question === card.question && 
                              c.answer === card.answer
                          );
                          return savedCard ? {...card, ...savedCard} : card;
                      });
                  } catch (e) {
                      console.error('Erreur de lecture du localStorage', e);
                  }
              }
              
              updateBoxCounters();
              updateNextReviewTimes();
              hideCardsList();
              preloadImages();
          })
          .catch(error => {
              console.error('Erreur:', error);
              alert('Erreur de chargement du fichier: ' + error.message);
          });
  }
  
  // Parser une ligne CSV
  function parseCSVLine(line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
              inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
              values.push(current);
              current = '';
          } else {
              current += char;
          }
      }
      
      values.push(current);
      return values.map(v => v.replace(/^"(.*)"$/, '$1').trim());
  }
  
  function preloadImages() {
    flashcards.forEach(card => {
        if (card.questionImage) {
            const img = new Image();
            img.src = card.questionImage;
            // Précharger aussi la version miniature
            new Image().src = card.questionImage;
        }
        if (card.answerImage) {
            new Image().src = card.answerImage;
        }
    });
}
  
  // Mettre à jour les compteurs
  function updateBoxCounters() {
      boxes.forEach((box, index) => {
          const boxNumber = index + 1;
          const boxCards = flashcards.filter(card => card.box === boxNumber);
          const count = boxCards.length;
          
          boxCounters[index].textContent = `${count} carte(s)`;
          
          if (count > 0) {
              const nextReview = getNextReviewTime(boxNumber);
              boxNextReviews[index].textContent = `Prochaine rev.: ${formatTime(nextReview)}`;
          } else {
              boxNextReviews[index].textContent = '';
          }
      });
  }
  
  // Calculer le prochain temps de révision
  function getNextReviewTime(boxNumber) {
      const boxCards = flashcards.filter(card => card.box === boxNumber);
      if (boxCards.length === 0) return null;
      
      return boxCards.reduce((min, card) => {
          const cardNextReview = card.lastReview + reviewIntervals[card.box - 1] * 3600 * 1000;
          return Math.min(min, cardNextReview);
      }, Infinity);
  }
  
  // Formater le temps
  function formatTime(timestamp) {
      if (!timestamp) return '';
      
      const now = Date.now();
      const date = new Date(timestamp);
      
      if (timestamp <= now) {
          return 'Maintenant';
      }
      
      const today = new Date();
      if (date.getDate() === today.getDate() && 
          date.getMonth() === today.getMonth() && 
          date.getFullYear() === today.getFullYear()) {
          return date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
      }
      
      return date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute:'2-digit'
      });
  }
  
function showCardsList(boxNumber) {
    const boxCards = flashcards.filter(card => card.box === boxNumber);
    cardsList.innerHTML = '';
    
    if (boxCards.length === 0) {
        cardsList.innerHTML = '<p class="text-gray-500">Aucune carte</p>';
    } else {
        boxCards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item flex items-start gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer';
            
            // Afficher la miniature si elle existe
            let thumbnailHtml = '';
            if (card.questionImage) {
                thumbnailHtml = `
                    <div class="thumbnail-container flex-shrink-0">
                        <img src="${card.questionImage}" 
                             alt="Miniature" 
                             class="thumbnail-image w-12 h-12 object-cover rounded border border-gray-200">
                    </div>
                `;
            }
            
            const displayText = card.question || (card.questionImage ? 'Carte avec image' : 'Carte sans texte');
            cardElement.innerHTML = `
                ${thumbnailHtml}
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 truncate">${displayText}</div>
                    <div class="card-next-review text-xs text-gray-500 mt-1">
                        Rev.: ${formatTime(card.lastReview + reviewIntervals[card.box - 1] * 3600 * 1000)}
                    </div>
                </div>
            `;
            
            cardElement.addEventListener('click', () => {
                currentBoxNumber = boxNumber;
                currentFlashcardIndex = flashcards.indexOf(boxCards[index]);
                showFlashcard();
            });
            
            cardsList.appendChild(cardElement);
        });
    }
    
    cardsListTitle.textContent = `Cartes de la boîte ${boxNumber}`;
    cardsListContainer.classList.remove('hidden');
}


  // Cacher la liste
  function hideCardsList() {
      cardsListContainer.classList.add('hidden');
  }
  
  // Afficher une flashcard
  function showFlashcard() {
      const card = flashcards[currentFlashcardIndex];
      
      questionContent.innerHTML = '';
      answerContent.innerHTML = '';
      
      // Afficher la question
      if (card.question) {
          const textElement = document.createElement('div');
          textElement.textContent = card.question;
          questionContent.appendChild(textElement);
      }
      
      if (card.questionImage) {
          const imgElement = document.createElement('img');
          imgElement.src = card.questionImage;
          imgElement.alt = 'Image question';
          imgElement.className = 'mx-auto my-3 max-w-full max-h-[300px] w-auto h-auto object-scale-down';
          
          imgElement.onerror = () => {
              imgElement.alt = 'Image non disponible';
              imgElement.className = 'image-error';
          };
          
          questionContent.appendChild(imgElement);
      }
      
      // Préparer la réponse
      if (card.answer) {
          const textElement = document.createElement('div');
          textElement.textContent = card.answer;
          answerContent.appendChild(textElement);
      }
      
      if (card.answerImage) {
          const imgElement = document.createElement('img');
          imgElement.src = card.answerImage;
          imgElement.alt = 'Image réponse';
          imgElement.className = 'mx-auto my-3 max-w-full max-h-[300px] w-auto h-auto object-scale-down';
          
          imgElement.onerror = () => {
              imgElement.alt = 'Image non disponible';
              imgElement.className = 'image-error';
          };
          
          answerContent.appendChild(imgElement);
      }
      
      lastReviewed.textContent = `Dernière révision: ${new Date(card.lastReview).toLocaleString('fr-FR')}`;
      
      answerSection.classList.add('hidden');
      showAnswerBtn.style.display = 'block';
      flashcardContainer.classList.remove('hidden');
  }
  
  // Gérer la réponse
  function handleAnswer(isCorrect) {
      const card = flashcards[currentFlashcardIndex];
      card.lastReview = Date.now();
      card.box = isCorrect ? Math.min(card.box + 1, 5) : 1;
      
      saveFlashcards();
      updateBoxCounters();
      updateNextReviewTimes();
      
      // Fermer le popup et revenir à la liste
      flashcardContainer.classList.add('hidden');
      showCardsList(currentBoxNumber);
  }
  
  // Sauvegarder les flashcards
  function saveFlashcards() {
      try {
          localStorage.setItem('leitnerFlashcards', JSON.stringify(flashcards));
      } catch (e) {
          console.error('Erreur de sauvegarde dans localStorage', e);
      }
  }
  
  // Initialiser l'app
  function initApp() {
      if (currentDeck) {
          loadFlashcards(currentDeck);
          startBtn.textContent = 'Changer de jeu';
      }
  }
  
  // Événements
  accordionBtn.addEventListener('click', () => {
      accordionContent.classList.toggle('max-h-0');
      accordionContent.classList.toggle('max-h-[500px]');
      accordionBtn.textContent = accordionContent.classList.contains('max-h-[500px]') 
          ? 'Mode d\'emploi ▲' 
          : 'Mode d\'emploi ▼';
  });
  
  boxes.forEach(box => {
      box.addEventListener('click', () => {
          const boxNumber = parseInt(box.dataset.boxNumber);
          showCardsList(boxNumber);
      });
  });
  
  showAnswerBtn.addEventListener('click', () => {
      answerSection.classList.remove('hidden');
      showAnswerBtn.style.display = 'none';
  });
  
  wrongAnswerBtn.addEventListener('click', () => handleAnswer(false));
  rightAnswerBtn.addEventListener('click', () => handleAnswer(true));
  
  resetBtn.addEventListener('click', () => {
      if (confirm('Réinitialiser toutes les cartes à la boîte 1?')) {
          flashcards.forEach(card => {
              card.box = 1;
              card.lastReview = Date.now();
          });
          saveFlashcards();
          updateBoxCounters();
          updateNextReviewTimes();
          hideCardsList();
      }
  });
  
  startBtn.addEventListener('click', () => {
      if (deckSelector.value) {
          currentDeck = deckSelector.value;
          initApp();
      } else {
          alert('Sélectionnez un jeu de flashcards');
      }
  });
  
  deckSelector.addEventListener('change', function() {
      if (this.value) {
          currentDeck = this.value;
          startBtn.disabled = false;
      }
  });
  
  // Initialisation
  loadCSVFiles();
  hideCardsList();
  flashcardContainer.classList.add('hidden');
  
  // Vérifier périodiquement les temps de révision
  setInterval(updateNextReviewTimes, 60000);
});