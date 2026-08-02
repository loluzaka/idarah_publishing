import {defineType} from 'sanity'
import {UserIcon} from '@sanity/icons'

export default defineType({
  name: 'author',
  title: 'Authors & Contributors',
  type: 'document',
  icon: UserIcon,

  fields: [
    {
      name: 'name',
      title: 'Author Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },

    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
      },
      validation: Rule => Rule.required(),
    },

    {
      name: 'qualifications',
      title: 'Qualifications / Role',
      type: 'string',
    },

    {
      name: 'biography',
      title: 'Biography',
      type: 'text',
    },

    {
      name: 'topics',
      title: 'Topics',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
    },
  ],

  preview: {
    select: {
      title: 'name',
      subtitle: 'qualifications',
    },
  },
})