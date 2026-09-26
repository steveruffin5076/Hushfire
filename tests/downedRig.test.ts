import { describe, expect, it } from 'vitest';
import { TopDownDownedRig } from '../src/graphics/TopDownDownedRig';

describe('TopDownDownedRig', () => {
  it('plays falling then downed idle after trigger', () => {
    const rig = new TopDownDownedRig();

    expect(rig.state).toBe('standing');
    rig.trigger();
    expect(rig.state).toBe('falling');

    rig.update(0.5);
    expect(rig.state).toBe('falling');
    rig.update(0.5);
    expect(rig.state).toBe('downed');

    rig.standUp();
    expect(rig.state).toBe('standing');
  });
});
