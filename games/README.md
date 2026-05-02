# Stratus Games

All games that run on Stratus are packaged as AppImages via scripts in this
directory. These AppImages require Wine to be installed on the host system and
also depend on a common launcher script that configures non-persistent
environments for each game instance.


## Development Setup

1.  Install the required dependencies: [`appimagetool`][appimagetool-releases],
    `bubblewrap`, `wine`, `wine-mono`, and `winetricks`

2.  Copy or link the `stratus-launcher` script to a directory in `$PATH`:
    `ln -srf ./stratus-launcher.sh ~/bin/stratus-launcher`

3.  Initialize the wine prefix: `stratus-launcher --init`

4.  Build and run a game: `./build-supertuxkart.sh && ./build/supertuxkart`


[appimagetool-releases]: https://github.com/AppImage/appimagetool/releases
