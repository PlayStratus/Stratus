# Stratus Games

Stratusd games are packaged as AppImages. However, these AppImages do not
contain any common dependencies shared between games (e.g. wine). These are
expected to be installed on the host system, along with a common launcher script
that sets up a non-persistent environment for each game instance.


## Development Setup

1.  Install dependencies: [`appimagetool`][appimagetool-releases], `bubblewrap`,
    `wine`, and `wine-mono`

2.  Copy or link the `stratus-launcher` script to a directory in `$PATH`: e.g.
    `ln -srf ./stratus-launcher.sh ~/bin/stratus-launcher`

3.  Build and run a game: `./build-supertuxkart.sh && ./build/supertuxkart`


[appimagetool-releases]: https://github.com/AppImage/appimagetool/releases
