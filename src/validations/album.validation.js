const Joi = require('@hapi/joi');
Joi.objectId = require('joi-objectid')(Joi);
const { idsArray } = require('./custom.validation');
const { Artist, Genre } = require('../models');

exports.oneAlbum = {
  params: Joi.object().keys({
    id: Joi.objectId().required()
  })
};

exports.severalAlbums = {
  query: Joi.object().keys({
    ids: Joi.string()
      .custom(idsArray(20))
      .required()
  })
};

exports.albumTracks = {
  params: Joi.object().keys({
    id: Joi.objectId().required()
  }),
  query: Joi.object().keys({
    limit: Joi.number()
      .min(1)
      .max(50)
      .default(20),
    offset: Joi.number().default(0)
  })
};

exports.release = {
  params: Joi.object().keys({
    id: Joi.objectId().required()
  }),
  body: Joi.object().keys({
    released: Joi.boolean()
      .required()
      .valid(true)
  })
};

exports.createAlbum = {
  body: Joi.object().keys({
    name: Joi.string()
      .min(1)
      .max(30)
      .required()
      .trim(),
    artists: Joi.array()
      .items(Joi.objectId())
      .min(1)
      .required(),
    genres: Joi.array()
      .items(Joi.objectId())
      .min(1)
      .required(),
    album_type: Joi.string()
      .valid('single', 'compilation', 'album')
      .required(),
    album_group: Joi.string()
      .valid('single', 'compilation', 'album', 'appears_on')
      .required(),
    release_date: Joi.string()
      .regex(
        /^([0-2][0-9]|(3)[0-1])(-)(((0)[0-9])|((1)[0-2]))(-)((1)[5-9]\d{2}|(2)(0)[0-1][0-9]|2020)$/
      )
      .message('Date must match the format "DD-MM-YYYY" and valid')
      .required()
  })
};

exports.updateAlbum = {
  params: Joi.object().keys({
    id: Joi.objectId().required()
  }),
  body: Joi.object()
    .keys({
      name: Joi.string()
        .min(1)
        .max(30)
        .trim(),
      artists: Joi.array()
        .items(Joi.objectId())
        .min(1),
      genres: Joi.array()
        .items(Joi.objectId())
        .min(1),
      album_type: Joi.string().valid('single', 'compilation', 'album'),
      album_group: Joi.string().valid(
        'single',
        'compilation',
        'album',
        'appears_on'
      ),
      release_date: Joi.string()
        .regex(
          /^([0-2][0-9]|(3)[0-1])(-)(((0)[0-9])|((1)[0-2]))(-)((1)[5-9]\d{2}|(2)(0)[0-1][0-9]|2020)$/
        )
        .message('Date must match the format "DD-MM-YYYY" and valid')
    })
    .min(1)
};

exports.createTrack = {
  params: Joi.object().keys({
    id: Joi.objectId().required()
  }),
  body: Joi.object().keys({
    name: Joi.string()
      .min(1)
      .max(30)
      .trim()
      .required(),
    artists: Joi.array()
      .items(Joi.objectId())
      .min(1)
      .required()
  })
};

exports.artistsExist = async artistIds => {
  const artists = await Artist.find({ _id: artistIds });
  if (artistIds.length !== artists.length) return false;
  return true;
};

exports.genresExist = async genreIds => {
  const genres = await Genre.find({ _id: genreIds });
  if (genreIds.length !== genres.length) return false;
  return true;
};