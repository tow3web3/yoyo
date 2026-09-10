import React from 'react';
import { Composition } from 'remotion';
import { Promo, FPS, DURATION } from './Promo';
import { Scenario1, DURATION as D1 } from './Scenario1';
import { Scenario2, DURATION as D2 } from './Scenario2';

export const Root = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="Scenario1" component={Scenario1} durationInFrames={D1} fps={FPS} width={1920} height={1080} />
    <Composition id="Scenario2" component={Scenario2} durationInFrames={D2} fps={FPS} width={1920} height={1080} />
  </>
);
