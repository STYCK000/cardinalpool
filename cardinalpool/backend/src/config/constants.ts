export const MAPUA_INTRAMUROS_DESTINATION = Object.freeze({
  name: 'Mapúa University - Intramuros (658 Muralla St, Intramuros, Manila)',
  shortName: 'Mapúa University Intramuros',
  address: '658 Muralla St, Intramuros, Manila, 1002 Metro Manila, Philippines',
  lat: 14.5902,
  lng: 120.9787,
});

export const ALLOWED_EMAIL_DOMAINS = Object.freeze({
  STUDENT: 'mymail.mapua.edu.ph',
  FACULTY: 'mapua.edu.ph',
});

export const STARTING_TOKEN_BALANCE = Number(process.env.STARTING_TOKEN_BALANCE || 100);
export const MIN_ADVANCE_BOOKING_HOURS = Number(process.env.MIN_ADVANCE_BOOKING_HOURS || 24);
export const MIN_ADVANCE_BOOKING_MS = MIN_ADVANCE_BOOKING_HOURS * 60 * 60 * 1000;

export const MAPUA_DEPARTMENTS = [
  'School of Civil, Environmental, and Geological Engineering (SCEGE)',
  'School of Chemical, Biological, and Materials Engineering and Sciences (CBMES)',
  'School of Electrical, Electronics, and Computer Engineering (EECE)',
  'School of Industrial Engineering and Engineering Management (IE-EMG)',
  'School of Mechanical and Manufacturing Engineering (MME)',
  'School of Architecture, Industrial Design, and the Built Environment (ARIDBE)',
  'School of Information Technology (SOIT)',
  'School of Media Studies (SMS)',
  'School of Social Sciences and Education (SSSE)',
  'School of Health Sciences (SOHS)',
  'E.T. Yuchengco School of Business (ETYSB)',
  'Senior High School (SHS)',
  'Administration / Campus Operations',
] as const;
