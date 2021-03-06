/*global describe, it*/
const expect = require('../unexpected-with-plugins');
const _ = require('lodash');
const urlTools = require('urltools');
const AssetGraph = require('../../lib/AssetGraph');
const query = AssetGraph.query;
const httpception = require('httpception');

describe('transforms/populate', function () {
    it('should handle a test case with an Html asset and some stylesheets when told not to follow relations to Css', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/populate/notToCss/'});
        await assetGraph.loadAssets('index.html')
            .populate({
                followRelations: {type: query.not('HtmlStyle')}
            });

        expect(assetGraph, 'to contain no assets', 'Css');

        const htmlStyles = assetGraph.findRelations({type: 'HtmlStyle'});
        expect(htmlStyles, 'to have length', 1);
        expect(htmlStyles[0].to.isLoaded, 'to equal', false);
        expect(htmlStyles[0].to.url, 'to equal', urlTools.resolveUrl(assetGraph.root, 'style.css'));
    });

    it('should handle a test case with custom protocols', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/populate/customProtocols/'});
        await assetGraph.loadAssets('index.html')
            .populate({followRelations: {to: {type: query.not('Css')}}});

        expect(assetGraph, 'to contain assets', 5);
        expect(assetGraph, 'to contain relations', 4);

        const matches = assetGraph.findAssets({url: /\/index\.html$/})[0].text.match(/<a [^>]*?>/g);
        expect(matches, 'not to be null');
        expect(matches, 'to have length', 4);
    });

    it('should populate a test case with protocol-relative urls from file:', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/populate/protocolRelativeUrls/'});
        await assetGraph.loadAssets('index.html')
            .populate({from: {url: /^file:/}});

        expect(assetGraph, 'to contain assets', 3);
        expect(assetGraph, 'to contain relations', 'HtmlScript', 3);

        expect(_.map(assetGraph.findRelations({type: 'HtmlScript'}), 'href'), 'to equal', [
            '//ajax.googleapis.com/ajax/libs/jquery/1.8.1/jquery.min.js',
            'http://ajax.googleapis.com/ajax/libs/jquery/1.8.1/jquery.min.js',
            'https://ajax.googleapis.com/ajax/libs/jquery/1.8.1/jquery.min.js'
        ]);

        expect(
            assetGraph.findRelations({type: 'HtmlScript', href: /^\/\//})[0].to,
            'to be',
            assetGraph.findRelations({type: 'HtmlScript', href: /^http:\/\//})[0].to
        );

        assetGraph.findAssets({type: 'JavaScript'}).forEach(function (javaScript) {
            javaScript.url = javaScript.url.match(/^(https?:)/)[1] + '//cdn.example.com/' + javaScript.fileName;
        });

        expect(_.map(assetGraph.findRelations({type: 'HtmlScript'}), 'hrefType'), 'to equal', [
            'protocolRelative',
            'absolute',
            'absolute'
        ]);

        expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text.match(/src="(.*?)"/g), 'to equal', [
            'src="//cdn.example.com/jquery.min.js"',
            'src="http://cdn.example.com/jquery.min.js"',
            'src="https://cdn.example.com/jquery.min.js"'
        ]);
    });

    describe('when followRelations is specified as an array of relation instances', function () {
        it('should support an empty array', function () {
            httpception();

            var assetGraph = new AssetGraph();
            assetGraph.addAsset({
                type: 'Html',
                url: 'https://example.com/',
                text: '<script src="foo.js"></script><script src="bar.js"></script>'
            });
            return assetGraph.populate({
                followRelations: []
            }).then(function () {
                expect(assetGraph, 'to contain no asset', { url: 'https://example.com/foo.js', isLoaded: true })
                    .and('to contain asset', { url: 'https://example.com/bar.js', isLoaded: false });
            });
        });

        it('should support an array with one item', function () {
            httpception({
                request: 'GET https://example.com/foo.js',
                response: {
                    body: 'alert("foo");'
                }
            });

            var assetGraph = new AssetGraph();
            var htmlAsset = assetGraph.addAsset({
                url: 'https://example.com/',
                text: '<script src="foo.js"></script>'
            });
            return assetGraph.populate({
                followRelations: [ htmlAsset.outgoingRelations[0] ]
            }).then(function () {
                expect(assetGraph, 'to contain asset', { url: 'https://example.com/foo.js', isLoaded: true });
            });
        });

        it('should support an array with multiple items', function () {
            httpception([
                {
                    request: 'GET https://example.com/foo.js',
                    response: {
                        body: 'alert("foo");'
                    }
                },
                {
                    request: 'GET https://example.com/bar.js',
                    response: {
                        body: 'alert("bar");'
                    }
                }
            ]);

            var assetGraph = new AssetGraph();
            var htmlAsset = assetGraph.addAsset({
                type: 'Html',
                url: 'https://example.com/',
                text: '<script src="foo.js"></script><script src="bar.js"></script><script src="quux.js"></script>'
            });
            return assetGraph.populate({
                followRelations: htmlAsset.outgoingRelations.slice(0, 2)
            }).then(function () {
                expect(assetGraph, 'to contain asset', { url: 'https://example.com/foo.js', isLoaded: true })
                    .and('to contain asset', { url: 'https://example.com/bar.js', isLoaded: true })
                    .and('to contain asset', { url: 'https://example.com/quux.js', isLoaded: false });
            });
        });
    });
});
