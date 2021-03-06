const express = require('express');
const { tracksController } = require('../../controllers');
const router = express.Router();
const catchAsync = require('../../utils/catchAsync');
const validate = require('../../middlewares/validate');
const { trackValidation } = require('../../validations');
const authMiddleware = require('../../middlewares/auth');

router
  .route('/:id')
  .get(
    catchAsync(authMiddleware.optionalAuth),
    validate(trackValidation.oneTrack),
    catchAsync(tracksController.getTrack)
  )
  .delete(
    catchAsync(authMiddleware.authenticate),
    authMiddleware.authorize('artist'),
    validate(trackValidation.oneTrack),
    catchAsync(tracksController.deleteTrack)
  )
  .patch(
    catchAsync(authMiddleware.authenticate),
    authMiddleware.authorize('artist'),
    validate(trackValidation.update),
    catchAsync(tracksController.updateTrack)
  )
  .post(
    catchAsync(authMiddleware.authenticate),
    authMiddleware.authorize('artist'),
    validate(trackValidation.oneTrack),
    tracksController.uploadTrack,
    catchAsync(tracksController.setTrack)
  );

router
  .route('/:id/download')
  .get(
    validate(trackValidation.oneTrack),
    catchAsync(authMiddleware.authenticate),
    authMiddleware.authorize('premium', 'artist'),
    catchAsync(tracksController.downloadTrack)
  );

router
  .route('/')
  .get(
    catchAsync(authMiddleware.optionalAuth),
    validate(trackValidation.getSeveral),
    catchAsync(tracksController.getTracks)
  );

module.exports = router;
