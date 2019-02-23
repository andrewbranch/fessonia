const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  fs = require('fs'),
  testHelpers = require('./helpers');

const FFmpegOption = require('../lib/ffmpeg_option');
const FilterChain = require('../lib/filter_chain');
const FilterNode = require('../lib/filter_node');
const filtersFixture = fs.readFileSync(`${__dirname}/fixtures/ffmpeg-filters.out`).toString();

describe('FFmpegOption', function () {
  it('provides option contexts', function () {
    expect(FFmpegOption.FFmpegOptionContexts).to.not.be.null;
  });
  it('creates an FFmpegOption object', function () {
    expect(new FFmpegOption(
      'ss',
      FFmpegOption.FFmpegOptionContexts.GLOBAL
    )).to.be.instanceof(FFmpegOption);
  });
  describe('input validation', function () {
    it('does not fail if the context is valid', function () {
      const C = FFmpegOption.FFmpegOptionContexts;
      expect(() => new FFmpegOption('y', C.GLOBAL)).not.to.throw;
      expect(() => new FFmpegOption('ss', C.INPUT)).not.to.throw;
      expect(() => new FFmpegOption('ss', C.OUTPUT)).not.to.throw;
    });
    it('fails if the context is invalid', function () {
      expect(() => new FFmpegOption('ss', false)).to.throw;
    });
    it('sets the argument when arg is a string', function () {
      const C = FFmpegOption.FFmpegOptionContexts;
      const fo = new FFmpegOption('ss', C.INPUT, '2545');
      expect(fo.arg).to.be.a('string');
      expect(fo.arg).to.eql('2545');
    });
    it('fails if arg is not a string', function () {
      const C = FFmpegOption.FFmpegOptionContexts;
      expect(() => new FFmpegOption('ss', C.INPUT, new Map([[2545, null]]))).to.throw;
      expect(() => new FFmpegOption('ss', C.INPUT, { 2545: null })).to.throw;
      expect(() => new FFmpegOption('ss', C.INPUT, [2545])).to.throw;
    });

    describe('with filters', function () {
      this.beforeEach(() => {
        // stub for ffmpeg interaction
        sinon.stub(FilterNode, '_queryFFmpegForFilters')
          .returns(filtersFixture);
        nodes = [
          new FilterNode('cropFilter', {
            filterName: 'crop',
            args: ['iw', 'ih/2', 0, 0]
          }),
          new FilterNode('vflipFilter', { filterName: 'vflip' }),
          new FilterNode('splitFilter', { filterName: 'split' })
        ];
        fc = new FilterChain('my_filter_chain', nodes);
      });

      this.afterEach(() => {
        FilterNode._queryFFmpegForFilters.restore();
      });

      it('handles all filter options as filter_complex with GLOBAL context', function () {
        const C = FFmpegOption.FFmpegOptionContexts;
        let fo;
        FFmpegOption.FFmpegFilterOptions.forEach((opt) => {
          fo = new FFmpegOption(opt, C.OUTPUT, fc);
          expect(fo.optionName).to.eql('-filter_complex');
          expect(fo.context).to.eql(C.GLOBAL);
        });
      });
    });
  });
  
  describe('toCommandArray()', function () {
    it('generates the correct command array segment for a global option', function () {
      const o = new FFmpegOption(
        'y',
        FFmpegOption.FFmpegOptionContexts.GLOBAL
      );
      const expected = ['-y'];
      expect(o.toCommandArray()).to.deep.eql(expected);
    });
    it('generates the correct command array segment for an input option', function () {
      const options = [
        new FFmpegOption(
          'bitexact',
          FFmpegOption.FFmpegOptionContexts.INPUT
        ),
        new FFmpegOption(
          'ss',
          FFmpegOption.FFmpegOptionContexts.INPUT,
          '5110.77'
        )
      ];
      const expected = [['-bitexact'], ['-ss', '5110.77']];
      for (let i = 0; i < options.length; i++) {
        expect(options[i].toCommandArray()).to.deep.eql(expected[i]);
      }
    });
    it('generates the correct command array segment for an output option', function () {
      const options = [
        new FFmpegOption(
          'dn',
          FFmpegOption.FFmpegOptionContexts.OUTPUT
        ),
        new FFmpegOption(
          'f',
          FFmpegOption.FFmpegOptionContexts.OUTPUT,
          'mp4'
        )
      ];
      const expected = [['-dn'], ['-f', 'mp4']];
      for (let i = 0; i < options.length; i++) {
        expect(options[i].toCommandArray()).to.deep.eql(expected[i]);
      }
    });
    describe('with FilterChain arguments', function () {
      this.beforeEach(() => {
        // stub for ffmpeg interaction
        sinon.stub(FilterNode, '_queryFFmpegForFilters').returns(filtersFixture);
        nodes = [
          new FilterNode('cropFilter', {
            filterName: 'crop',
            args: ['iw', 'ih/2', 0, 0]
          }),
          new FilterNode('vflipFilter', { filterName: 'vflip' }),
          new FilterNode('splitFilter', { filterName: 'split' })
        ];
        connections = [
          [['cropFilter', '0'], ['splitFilter', '0']],
          [['splitFilter', '0'], ['vflipFilter', '0']],
          [['splitFilter', '1'], ['vflipFilter', '0']]
        ];
        fc = new FilterChain('my_filter_chain', nodes, null, connections);
      });
  
      this.afterEach(() => {
        FilterNode._queryFFmpegForFilters.restore();
      });

      it('generates the correct command array segment for an output filter option', function () {
        // create FilterChain object
        const option = new FFmpegOption(
          'filter',
          FFmpegOption.FFmpegOptionContexts.OUTPUT,
          fc
        );
        const expected = ['-filter_complex', 'crop=iw:ih/2:0:0 [cropFilter_0];[cropFilter_0] split [splitFilter_0] [splitFilter_1];[splitFilter_0] vflip;[splitFilter_1] vflip'];
        expect(option.toCommandArray()).to.deep.eql(expected);
      });
    });
  });

  describe('toCommandString()', function () {
    it('generates the correct command string segment for a global option', function () {
      const o = new FFmpegOption(
        'y',
        FFmpegOption.FFmpegOptionContexts.GLOBAL
      );
      const expected = '-y';
      expect(o.toCommandString()).to.eql(expected);
    });
    it('generates the correct command array segment for an input option', function () {
      const options = [
        new FFmpegOption(
          'bitexact',
          FFmpegOption.FFmpegOptionContexts.INPUT
        ),
        new FFmpegOption(
          'ss',
          FFmpegOption.FFmpegOptionContexts.INPUT,
          '5110.77'
        )
      ];
      const expected = ['-bitexact', '-ss 5110.77'];
      for (let i = 0; i < options.length; i++) {
        expect(options[i].toCommandString()).to.eql(expected[i]);
      }
    });
    it('generates the correct command array segment for an output option', function () {
      const options = [
        new FFmpegOption(
          'dn',
          FFmpegOption.FFmpegOptionContexts.OUTPUT
        ),
        new FFmpegOption(
          'f',
          FFmpegOption.FFmpegOptionContexts.OUTPUT,
          'mp4'
        )
      ];
      const expected = ['-dn', '-f mp4'];
      for (let i = 0; i < options.length; i++) {
        expect(options[i].toCommandString()).to.deep.eql(expected[i]);
      }
    });
    describe('with FilterChain arguments', function () {
      this.beforeEach(() => {
        // stub for ffmpeg interaction
        sinon.stub(FilterNode, '_queryFFmpegForFilters').returns(filtersFixture);
        nodes = [
          new FilterNode('cropFilter', {
            filterName: 'crop',
            args: ['iw', 'ih/2', 0, 0]
          }),
          new FilterNode('vflipFilter', { filterName: 'vflip' }),
          new FilterNode('splitFilter', { filterName: 'split' })
        ];
        connections = [
          [['cropFilter', '0'], ['splitFilter', '0']],
          [['splitFilter', '0'], ['vflipFilter', '0']],
          [['splitFilter', '1'], ['vflipFilter', '0']]
        ];
        fc = new FilterChain('my_filter_chain', nodes, null, connections);
      });
  
      this.afterEach(() => {
        FilterNode._queryFFmpegForFilters.restore();
      });

      it('generates the correct command array segment for an output filter option', function () {
        // create FilterChain object
        const option = new FFmpegOption(
          'filter',
          FFmpegOption.FFmpegOptionContexts.OUTPUT,
          fc
        );
        const expected = '-filter_complex crop=iw:ih/2:0:0 [cropFilter_0];[cropFilter_0] split [splitFilter_0] [splitFilter_1];[splitFilter_0] vflip;[splitFilter_1] vflip';
        expect(option.toCommandString()).to.deep.eql(expected);
      });
    });
  });
});
