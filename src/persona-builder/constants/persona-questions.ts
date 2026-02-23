import { PersonaArchetype } from '../enums/persona-archetype.enum';

export interface PersonaQuestionOption {
  id: string;
  text: string;
  archetype: PersonaArchetype;
}

export interface PersonaQuestion {
  id: string;
  question: string;
  options: PersonaQuestionOption[];
}

export const PERSONA_QUESTIONS: PersonaQuestion[] = [
  {
    id: '1',
    question: 'When presenting ideas in meetings, I typically:',
    options: [
      {
        id: '1a',
        text: 'Wait to be asked',
        archetype: PersonaArchetype.Executor,
      },
      {
        id: '1b',
        text: 'Build on others\' ideas',
        archetype: PersonaArchetype.Collaborator,
      },
      {
        id: '1c',
        text: 'Present ideas clearly',
        archetype: PersonaArchetype.Innovator,
      },
      {
        id: '1d',
        text: 'Challenge assumptions',
        archetype: PersonaArchetype.Leader,
      },
    ],
  },
  {
    id: '2',
    question: 'My work approach is best described as:',
    options: [
      {
        id: '2a',
        text: 'Steady, reliable',
        archetype: PersonaArchetype.Executor,
      },
      {
        id: '2b',
        text: 'Creative, flexible',
        archetype: PersonaArchetype.Innovator,
      },
      {
        id: '2c',
        text: 'Results-driven',
        archetype: PersonaArchetype.Leader,
      },
      {
        id: '2d',
        text: 'People-focused',
        archetype: PersonaArchetype.Collaborator,
      },
    ],
  },
  {
    id: '3',
    question: 'When problem-solving, I:',
    options: [
      {
        id: '3a',
        text: 'Execute tasks efficiently',
        archetype: PersonaArchetype.Executor,
      },
      {
        id: '3b',
        text: 'Bring people together',
        archetype: PersonaArchetype.Collaborator,
      },
      {
        id: '3c',
        text: 'Develop strategic approach',
        archetype: PersonaArchetype.Leader,
      },
      {
        id: '3d',
        text: 'Find unconventional solutions',
        archetype: PersonaArchetype.Innovator,
      },
    ],
  },
  {
    id: '4',
    question: 'My preference at work is to:',
    options: [
      {
        id: '4a',
        text: 'Work behind the scenes',
        archetype: PersonaArchetype.Executor,
      },
      {
        id: '4b',
        text: 'Share credit with team',
        archetype: PersonaArchetype.Collaborator,
      },
      {
        id: '4c',
        text: 'Present work when appropriate',
        archetype: PersonaArchetype.Innovator,
      },
      {
        id: '4d',
        text: 'Lead high-profile initiatives',
        archetype: PersonaArchetype.Leader,
      },
    ],
  },
  {
    id: '5',
    question: 'My career aspiration is to:',
    options: [
      {
        id: '5a',
        text: 'Be a recognized expert',
        archetype: PersonaArchetype.Executor,
      },
      {
        id: '5b',
        text: 'Lead teams',
        archetype: PersonaArchetype.Leader,
      },
      {
        id: '5c',
        text: 'Create innovative solutions',
        archetype: PersonaArchetype.Innovator,
      },
      {
        id: '5d',
        text: 'Build influence',
        archetype: PersonaArchetype.Leader,
      },
    ],
  },
  {
    id: '6',
    question: 'The area I want to develop most is:',
    options: [
      {
        id: '6a',
        text: 'Speaking with confidence',
        archetype: PersonaArchetype.Leader,
      },
      {
        id: '6b',
        text: 'Building relationships',
        archetype: PersonaArchetype.Collaborator,
      },
      {
        id: '6c',
        text: 'Strategic communication',
        archetype: PersonaArchetype.Leader,
      },
      {
        id: '6d',
        text: 'Executive presence',
        archetype: PersonaArchetype.Leader,
      },
    ],
  },
];














