var _ = require("underscore"),
   events = require("./events"),
   qualitySelectorFactory = require("./components/QualitySelector"),
   sourceInterceptorFactory = require("./middleware/SourceInterceptor"),
   SafeSeek = require("./util/SafeSeek");

module.exports = function (videojs) {
   videojs = videojs || window.videojs;

   qualitySelectorFactory(videojs);
   sourceInterceptorFactory(videojs);

   videojs.hook("setup", function (player) {
      function changeQuality(event, newSource) {
         let sources = player.currentSources(),
            currentTime = player.currentTime(),
            currentPlaybackRate = player.playbackRate(),
            isPaused = player.paused(),
            selectedSource;

         // Clear out any previously selected sources (see: #11)
         _.each(sources, function (source) {
            source.selected = false;
         });
         //selectedSource = _.findWhere(sources, { src: newSource.src });
         selectedSource = {
            src: newSource.src,
            selected: true,
            type: newSource.type,
            label: newSource.label,
         };
         for (let i = 0; i < sources.length; i++) {
            if (sources[i].src === newSource.src) {
               sources[i] = {
                  src: sources[i].src,
                  selected: true,
                  type: sources[i].type,
                  label: sources[i].label,
               };
            } else {
               sources[i] = {
                  src: sources[i].src,
                  selected: false,
                  type: sources[i].type,
                  label: sources[i].label,
               };
            }
         }
         // Note: `_.findWhere` returns a reference to an object. Thus the
         // following updates the original object in `sources`.
         //selectedSource.selected = true;

         if (player._qualitySelectorSafeSeek) {
            player._qualitySelectorSafeSeek.onQualitySelectionChange();
         }

         player.src(sources);

         player.ready(function () {
            if (
               !player._qualitySelectorSafeSeek ||
               player._qualitySelectorSafeSeek.hasFinished()
            ) {
               // Either we don't have a pending seek action or the one that we have is no
               // longer applicable. This block must be within a `player.ready` callback
               // because the call to `player.src` above is asynchronous, and so not
               // having it within this `ready` callback would cause the SourceInterceptor
               // to execute after this block instead of before.
               //
               // We save the `currentTime` within the SafeSeek instance because if
               // multiple QUALITY_REQUESTED events are received before the SafeSeek
               // operation finishes, the player's `currentTime` will be `0` if the
               // player's `src` is updated but the player's `currentTime` has not yet
               // been set by the SafeSeek operation.
               player._qualitySelectorSafeSeek = new SafeSeek(
                  player,
                  currentTime
               );
               player.playbackRate(currentPlaybackRate);
            }

            if (!isPaused) {
               player.play();
            }
         });
      }

      // Add handler to switch sources when the user requests a change
      player.on(events.QUALITY_REQUESTED, changeQuality);
   });
};

module.exports.EVENTS = events;
