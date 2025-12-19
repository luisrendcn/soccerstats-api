import { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'es';

const translations = {
  en: {
    // Navigation
    home: 'Home',
    teams: 'Teams',
    matches: 'Matches',
    language: 'Language',

    // Home page
    leagueOverview: 'League Overview',
    standings: 'Standings',
    viewAllTeams: 'View All Teams',
    recentResults: 'Recent Results',
    viewSchedule: 'View Schedule',
    noTeamsRegistered: 'No teams registered yet.',
    noMatchesPlayed: 'No matches played yet.',
    scheduleAMatch: 'Schedule a Match',

    // Teams page
    teamsTitle: 'Teams',
    createNewTeam: 'Create New Team',
    registerNewTeam: 'Register New Team',
    teamName: 'Team Name',
    teamColor: 'Team Color',
    createTeam: 'Create Team',
    creating: 'Creating...',
    tapToViewRoster: 'Tap to view roster',
    teamCreated: 'Team created!',
    hasBeenAdded: 'has been added.',

    // Team Details page
    roster: 'Roster',
    addPlayer: 'Add Player',
    playerName: 'Player Name',
    playerNumber: 'Player Number',
    noPlayersAdded: 'No players added yet.',
    matchHistory: 'Match History',
    noMatchHistory: 'No match history yet.',

    // Matches page
    matchSchedule: 'Match Schedule',
    all: 'All',
    scheduled: 'Scheduled',
    finished: 'Finished',
    noMatches: 'No matches found.',
    scheduleNewMatch: 'Schedule New Match',

    // Match Details
    goals: 'Goals',
    addGoal: 'Add Goal',
    minute: 'Minute',
    scorer: 'Scorer',
    finishMatch: 'Finish Match',
    matchFinished: 'Match Finished',

    // Create Match
    createNewMatch: 'Create New Match',
    homeTeam: 'Home Team',
    awayTeam: 'Away Team',
    date: 'Date & Time',
    location: 'Location (Optional)',
    selectTeam: 'Select a team',

    // Common
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    back: 'Back',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    noResultsFound: 'No results found.',
  },
  es: {
    // Navigation
    home: 'Inicio',
    teams: 'Equipos',
    matches: 'Partidos',
    language: 'Idioma',

    // Home page
    leagueOverview: 'Resumen de Liga',
    standings: 'Posiciones',
    viewAllTeams: 'Ver Todos los Equipos',
    recentResults: 'Resultados Recientes',
    viewSchedule: 'Ver Calendario',
    noTeamsRegistered: 'Ningún equipo registrado aún.',
    noMatchesPlayed: 'Ningún partido jugado aún.',
    scheduleAMatch: 'Programar un Partido',

    // Teams page
    teamsTitle: 'Equipos',
    createNewTeam: 'Crear Nuevo Equipo',
    registerNewTeam: 'Registrar Nuevo Equipo',
    teamName: 'Nombre del Equipo',
    teamColor: 'Color del Equipo',
    createTeam: 'Crear Equipo',
    creating: 'Creando...',
    tapToViewRoster: 'Toca para ver alineación',
    teamCreated: '¡Equipo creado!',
    hasBeenAdded: 'ha sido agregado.',

    // Team Details page
    roster: 'Alineación',
    addPlayer: 'Agregar Jugador',
    playerName: 'Nombre del Jugador',
    playerNumber: 'Número del Jugador',
    noPlayersAdded: 'Ningún jugador agregado aún.',
    matchHistory: 'Historial de Partidos',
    noMatchHistory: 'Sin historial de partidos.',

    // Matches page
    matchSchedule: 'Calendario de Partidos',
    all: 'Todos',
    scheduled: 'Programados',
    finished: 'Finalizados',
    noMatches: 'No se encontraron partidos.',
    scheduleNewMatch: 'Programar Nuevo Partido',

    // Match Details
    goals: 'Goles',
    addGoal: 'Agregar Gol',
    minute: 'Minuto',
    scorer: 'Goleador',
    finishMatch: 'Finalizar Partido',
    matchFinished: 'Partido Finalizado',

    // Create Match
    createNewMatch: 'Crear Nuevo Partido',
    homeTeam: 'Equipo Local',
    awayTeam: 'Equipo Visitante',
    date: 'Fecha y Hora',
    location: 'Ubicación (Opcional)',
    selectTeam: 'Selecciona un equipo',

    // Common
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    add: 'Agregar',
    back: 'Atrás',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    noResultsFound: 'No se encontraron resultados.',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('language') as Language) || 'en';
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: keyof typeof translations.en): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
