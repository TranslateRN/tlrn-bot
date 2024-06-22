/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

export const TL_COMMAND = {
  name: 'translate',
  type: 1,
  description: 'Translate the i18n ICU message to the target languages',
  options: [
    {
      name: 'language',
      description: 'The target language to translate to',
      type: 3,
      required: true,
      choices: [
        { name: 'English', value: 'en' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Chinese', value: 'zh' },
      ],
    },
    {
      name: 'file',
      description: 'The file containing the ICU messages to translate',
      type: 11,
      required: true,
    },
  ],
};
