const { queueService, userService, playerService, deviceService, trackService, playHistoryService } = require('../services');
const AppError = require('../utils/AppError.js');

/**
 * Move element in array from a position to another
 * 
 * @method
 * @private
 * @author Abdelrahman Tarek
 * @param {Number} from from position
 * @param {Number} to to position
 * @summary Move element in array from a position to another
 * @see https://stackoverflow.com/questions/5306680/move-an-array-element-from-one-array-position-to-anothers
 */
Array.prototype.move = function (from, to) {
  this.splice(to, 0, this.splice(from, 1)[0]);
  return this;
};


/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 400 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description get user queue
 * @summary Get user Queue
 */
exports.getQueue = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }
  const queues = await userService.getUserQueues(req.user._id);

  const queueIndex = req.query.queueIndex || 0;

  if (!queues || queueIndex > queues.length - 1) {
    return next(new AppError('No Queue with the given index', 400));
  }

  const id = queues[queueIndex];

  const queue = await queueService.getQueueById(id, { sort: true });

  if (!queue || !queue.tracks || !queue.tracks.length) {
    return res.status(204).end();
  }

  res.status(200).json({
    tracks: queue.tracks,
    total: queue.tracks.length
  })
};

/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 404 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description Change repeat mode
 * @summary Repeat the queue
 */
exports.repeatQueue = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }

  const { state, deviceId } = req.query;

  const id = req.user._id;

  let player = await playerService.getPlayer(id, { populate: false });

  if (!player) {
    return next(new AppError('Player is not found', 404));
  }

  if (player.currentlyPlayingType === 'ad')
    return next(new AppError('You cannot repeat while the ad is playing', 403));

  if (deviceId) {
    player = await playerService.addDeviceToPlayer(player, deviceId);
    if (!player)
      return next(new AppError('Device is not found', 404));
  }

  player.repeatState = state;

  await player.save();

  res.status(204).end();
};


/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 404 status
 * @throws AppError 400 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description Add a track to the queue
 * @summary Add to the queue
 */
exports.addToQueue = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }

  const { queueIndex, deviceId, trackId } = req.query;

  const id = req.user._id;

  let [player, queues] = await Promise.all([
    playerService.getPlayer(id, { populate: false }),
    userService.getUserQueues(req.user._id)
  ]);

  if (!player) {
    return next(new AppError('Player is not found', 404));
  }

  if (!queues || !queues.length) {
    return next(new AppError('Queue is not found', 404));
  }

  if (queueIndex) {
    if (queues.length < 2) {
      return next(new AppError('No queue with queueIndex=1', 400));
    }

    queues.reverse();
  }

  if (deviceId) {
    player = await playerService.addDeviceToPlayer(player, deviceId);
    if (!player)
      return next(new AppError('Device is not found', 404));
    // save player
    player.save();
  }

  const track = await trackService.findTrackUtil(trackId);

  if (!track) {
    return next(new AppError('Track is not found', 404));
  }

  await queueService.appendToQueue(queues[0], [trackId]);

  res.status(204).end();
};


/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 404 status
 * @throws AppError 400 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description Edit track position
 * @summary Edit track position
 */
exports.editPosition = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }

  let {
    queueIndex,
    trackIndex,
    trackId,
    newIndex
  } = req.query;

  const id = req.user._id;

  let [player, queues] = await Promise.all([
    playerService.getPlayer(id, { populate: false }),
    userService.getUserQueues(req.user._id)
  ]);

  if (!player) {
    return next(new AppError('Player is not found', 404));
  }

  if (player.currentlyPlayingType === 'ad')
    return next(new AppError('You cannot edit position while the ad is playing', 403));

  if (!queues || !queues.length) {
    return next(new AppError('Queue is not found', 404));
  }

  if (queueIndex) {
    if (queues.length < 2) {
      return next(new AppError('No queue with queueIndex=1', 400));
    }

    queues.reverse();
  }

  if ((trackIndex === undefined && trackId === undefined) || (trackIndex !== undefined && trackId !== undefined)) {
    return next(new AppError('You must only pass trackIndex or trackId', 400));
  }

  const queue = await queueService.getQueueById(queues[0], { selectDetails: true });

  if (!queue || !queue.tracks) {
    return next(new AppError('Queue is not found', 404));
  }

  if (trackIndex !== undefined) {
    if (queue.tracks.length <= trackIndex) {
      return next(new AppError(`Track with trackIndex=${trackIndex} is not found`, 404));
    }
  }
  else {
    trackIndex = queue.tracks.indexOf(trackId);

    // if shuffle mode
    if (queue.shuffleList && queue.shuffleList.length) {
      trackIndex = queue.shuffleList.indexOf(trackIndex);
    }

    if (trackIndex === -1) {
      return next(new AppError(`Track with trackId=${trackId} is not found`, 404));
    }
  }

  if (queue.tracks.length <= newIndex) {
    return next(new AppError(`newIndex=${newIndex} is wrong`, 400));
  }

  if (queue.shuffleList && queue.shuffleList.length) { // if shuffle mode
    queue.shuffleList.move(trackIndex, newIndex);

    if (queue.shuffleIndex === trackIndex) queue.shuffleIndex = newIndex;

    queue.currentIndex = queue.shuffleList[queue.shuffleIndex];
  } else {
    queue.tracks.move(trackIndex, newIndex);

    if (queue.currentIndex === trackIndex) queue.currentIndex = newIndex;  // if we edit the current track position
  }

  await queue.save();

  res.status(204).end();
};


/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 404 status
 * @throws AppError 400 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description Delete track from queue
 * @summary Delete track
 */
exports.deleteTrack = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }

  let {
    queueIndex,
    trackIndex,
    trackId
  } = req.query;

  const id = req.user._id;

  const [player, queues] = await Promise.all([
    playerService.getPlayer(id, { populate: false }),
    userService.getUserQueues(req.user._id)
  ]);

  if (!player) {
    return next(new AppError('Player is not found', 404));
  }

  if (player.currentlyPlayingType === 'ad')
    return next(new AppError('You cannot delete while the ad is playing', 403));

  if (!queues || !queues.length) {
    return next(new AppError('Queue is not found', 404));
  }

  if (queueIndex) {
    if (queues.length < 2) {
      return next(new AppError('No queue with queueIndex=1', 400));
    }

    queues.reverse();
  }

  if ((trackIndex === undefined && trackId === undefined) || (trackIndex !== undefined && trackId !== undefined)) {
    return next(new AppError('You must only pass trackIndex or trackId', 400));
  }

  const queue = await queueService.getQueueById(queues[0], { selectDetails: true });

  if (!queue || !queue.tracks) {
    return next(new AppError('Queue is not found', 404));
  }

  if (trackIndex !== undefined) {
    if (queue.tracks.length <= trackIndex) {
      return next(new AppError(`Track with trackIndex=${trackIndex} is not found`, 404));
    }
  }
  else {
    trackIndex = queue.tracks.indexOf(trackId);

    if (queue.shuffleList && queue.shuffleList.length) {
      trackIndex = queue.shuffleList[trackIndex]; // get the real index if shuffle mode is on
    }

    if (trackIndex === -1) {
      return next(new AppError(`Track with trackId=${trackId} is not found`, 404));
    }
  }

  queue.tracks.splice(trackIndex, 1);

  if (queue.shuffleList && queue.shuffleList.length) { // if shuffle mode delete from shuffle list
    let index = queue.shuffleList.indexOf(trackIndex);
    queue.shuffleList.splice(index, 1);
  }

  if (trackIndex === queue.currentIndex) {
    // set all to default
    if (queue.tracks && queue.tracks.length)
      await playerService.addTrackToPlayer(player, queue.tracks[0], queue.context);

    queueService.setQueueToDefault(queue);
    player.shuffleState = false;
  }

  if (!queue.tracks.length) {
    // delete the queue
    queues.splice(0, 1);
    queueService.deleteQueueById(queue._id);

    req.user.queues = queues;

    if (!queues || !queues.length) {
      playerService.setPlayerToDefault(player);
    } else {
      const queue = await queueService.getQueueById(queues[0], { selectDetails: true });
      if (queue && queue.tracks.length) {
        player.repeatState = 'off'

        if (queue.shuffleList && queue.shuffleList.length) player.shuffleState = true;
        else player.shuffleState = false;

        await playerService.addTrackToPlayer(player, queue.tracks[0], queue.context);
      } else
        playerService.setPlayerToDefault(player);
    }

    await Promise.all([
      player.save(),
      req.user.save({ validateBeforeSave: true })
    ]);
  } else {
    await Promise.all([
      player.save(),
      queue.save({ validateBeforeSave: true })
    ]);
  }

  res.status(204).end();
};


/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 404 status
 * @throws AppError 400 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description Change shuffle state of the queue
 * @summary Change shuffle state of the queue
 */
exports.shuffleQueue = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }

  const { state, deviceId } = req.query;

  const id = req.user._id;

  let [player, queues] = await Promise.all([
    playerService.getPlayer(id, { populate: false }),
    userService.getUserQueues(req.user._id)
  ]);

  if (!player) {
    return next(new AppError('Player is not found', 404));
  }

  if (player.currentlyPlayingType === 'ad')
    return next(new AppError('You cannot shuffle while the ad is playing', 403));

  if (!queues || !queues.length) {
    return next(new AppError('Queue is not found', 404));
  }

  if (deviceId) {
    player = await playerService.addDeviceToPlayer(player, deviceId);
    if (!player)
      return next(new AppError('Device is not found', 404));
  }

  let queue = await queueService.getQueueById(queues[0], { selectDetails: true });

  if (!queue || !queue.tracks) {
    return next(new AppError('Queue is not found', 404));
  }

  player.shuffleState = state;

  if (state) {
    queue = queueService.shuffleQueue(queue);
  } else {
    queue.shuffleList = undefined;
    queue.shuffleIndex = undefined;
  }

  await Promise.all([
    player.save(),
    queue.save()
  ]);

  res.status(204).end();
};


/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 404 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description Play the next track
 * @summary Play the next track
 */
exports.nextTrack = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }

  const { deviceId } = req.query;

  const id = req.user._id;

  let [player, queues] = await Promise.all([
    playerService.getPlayer(id, { populate: false }),
    userService.getUserQueues(req.user._id)
  ]);

  if (!player) {
    return next(new AppError('Player is not found', 404));
  }

  if (!queues || !queues.length) {
    return next(new AppError('Queue is not found', 404));
  }

  if (deviceId) {
    player = await playerService.addDeviceToPlayer(player, deviceId);
    if (!player)
      return next(new AppError('Device is not found', 404));
  }

  let queue = await queueService.getQueueById(queues[0], { selectDetails: true });

  if (!queue || !queue.tracks) {
    return next(new AppError('Queue is not found', 404));
  }

  if (player.currentlyPlayingType !== 'ad')
    queue = await queueService.goNext(queue, player, queues);

  await playerService.addTrackToPlayer(player, queue.tracks[queue.currentIndex], queue.context); // add the next track to player item

  playHistoryService.addToHistory(id, player.context); // add to history

  req.user.queues = queues;

  await Promise.all([
    queue.save(),
    player.save(),
    req.user.save()
  ]);
  res.status(204).end();
};


/**
 * @version 1.0.0
 * @public
 * @async
 * @throws AppError 500 status
 * @throws AppError 404 status
 * @author Abdelrahman Tarek
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @description Play the Previous track
 * @summary Play the Previous track
 */
exports.previousTrack = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Must Authenticate user', 500));
  }

  const { deviceId } = req.query;

  const id = req.user._id;

  let [player, queues] = await Promise.all([
    playerService.getPlayer(id, { populate: false }),
    userService.getUserQueues(req.user._id)
  ]);

  if (!player) {
    return next(new AppError('Player is not found', 404));
  }

  if (!queues || !queues.length) {
    return next(new AppError('Queue is not found', 404));
  }

  if (deviceId) {
    player = await playerService.addDeviceToPlayer(player, deviceId);
    if (!player)
      return next(new AppError('Device is not found', 404));
  }

  let queue = await queueService.getQueueById(queues[0], { selectDetails: true });

  if (!queue || !queue.tracks) {
    return next(new AppError('Queue is not found', 404));
  }

  if (player.currentlyPlayingType !== 'ad')
    queue = await queueService.goPrevious(queue, player, queues);

  await playerService.addTrackToPlayer(player, queue.tracks[queue.currentIndex], queue.context); // add the next track to player item

  playHistoryService.addToHistory(id, player.context); // add to history

  req.user.queues = queues;

  await Promise.all([
    queue.save(),
    player.save(),
    req.user.save()
  ]);
  res.status(204).end();
};