#!/usr/bin/env sh

# Usage: ./build-freedoom.sh [<app-image-path>]

# This script creates a AppImage for Freedoom that uses stratus-launcher.

set -e

# Create temporary build directory
BUILD_DIR=$(mktemp -d -p /tmp stratus-game-build-XXXXXX)
cleanup() {
    [ -d $BUILD_DIR ] && rm -rf $BUILD_DIR
}
trap cleanup EXIT

# Create directories
APPDIR=$BUILD_DIR/AppDir
BIN_DIR=$APPDIR/usr/bin
SYS_DIR=$APPDIR/c/freedoom
HOME_DIR=$APPDIR/home
mkdir --parents $BIN_DIR $SYS_DIR $HOME_DIR

# Download and extract files
ZIP_CD=$BUILD_DIR/crispydoom.zip
ZIP_FD=$BUILD_DIR/freedoom.zip
UNZIP_CD=$BUILD_DIR/crispydoom
UNZIP_FD=$BUILD_DIR/freedoom
wget https://github.com/fabiangreffrath/crispy-doom/releases/download/crispy-doom-7.1/crispy-doom-7.1.0-win64.zip -O $ZIP_CD
wget https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip -O $ZIP_FD
wget https://avatars.githubusercontent.com/u/6082165?s=256 -O $APPDIR/io.playstratus.freedoom.png
unzip -q $ZIP_CD -d $UNZIP_CD
unzip -q $ZIP_FD -d $UNZIP_FD
mv $UNZIP_CD/* $SYS_DIR
mv $UNZIP_FD/freedoom-0.13.0/freedoom1.wad $SYS_DIR

# Add run script
cat << EOF > $BIN_DIR/freedoom
#!/usr/bin/sh

DISPLAY= stratus-launcher wine freedoom/crispy-doom.exe -iwad \
    freedoom/freedoom1.wad -episode 1
EOF
chmod +x $BIN_DIR/freedoom

# Add desktop file
cat << EOF > $APPDIR/io.playstratus.freedoom.desktop
[Desktop Entry]
X-AppImage-Arch=x86_64
X-AppImage-Version=1.5.0
X-AppImage-Name=Freedoom
Type=Application
Name=Freedoom
Exec=/usr/bin/freedoom
Categories=Game
Icon=io.playstratus.freedoom
EOF

# Create config files (generated with crispy-setup.exe)
# Note that joystick_guid is generated from the gamepad device IDs and name
# ("stratus"), and should therefore be constant.
cat << EOF > $SYS_DIR/crispy-doom.cfg
video_driver                  ""
window_position               ""
fullscreen                    1
video_display                 0
aspect_ratio_correct          1
smooth_pixel_scaling          1
integer_scaling               0
vga_porch_flash               0
window_width                  800
window_height                 600
fullscreen_width              0
fullscreen_height             0
force_software_renderer       0
max_scaling_buffer_pixels     16000000
startup_delay                 1000
show_endoom                   0
show_diskicon                 1
png_screenshots               1
mouse_acceleration_y          1.000000
mouse_threshold_y             0
snd_samplerate                44100
snd_cachesize                 67108864
snd_maxslicetime_ms           28
snd_pitchshift                0
snd_musiccmd                  ""
snd_dmxoption                 "-opl3"
opl_io_port                   0x388
use_libsamplerate             1
libsamplerate_scale           1.000000
autoload_path                 ""
music_pack_path               "C:\freedoom\music-packs"
fsynth_chorus_active          1
fsynth_chorus_depth           5.000000
fsynth_chorus_level           0.350000
fsynth_chorus_nr              3
fsynth_chorus_speed           0.300000
fsynth_midibankselect         "gs"
fsynth_polyphony              256
fsynth_reverb_active          1
fsynth_reverb_damp            0.400000
fsynth_reverb_level           0.150000
fsynth_reverb_roomsize        0.600000
fsynth_reverb_width           4.000000
fsynth_gain                   1.000000
fsynth_sf_path                ""
timidity_cfg_path             ""
gus_patch_path                ""
gus_ram_kb                    1024
winmm_midi_device             ""
winmm_complevel               1
winmm_reset_type              1
winmm_reset_delay             0
vanilla_keyboard_mapping      1
a11y_sector_lighting          1
a11y_extra_lighting           0
a11y_weapon_flash             1
a11y_weapon_palette           1
a11y_weapon_pspr              1
a11y_palette_changes          1
a11y_invul_colormap           1
player_name                   "Stratus"
grabmouse                     1
novert                        1
mouse_acceleration            2.000000
mouse_threshold               10
mouseb_strafeleft             -1
mouseb_straferight            -1
mouseb_turnleft               -1
mouseb_turnright              -1
mouseb_use                    -1
mouseb_backward               -1
mouseb_prevweapon             4
mouseb_nextweapon             3
dclick_use                    1
joystick_guid                 "03006374737472617475730000007200"
joystick_index                0
use_analog                    1
joystick_x_axis               2
joystick_x_invert             0
joystick_turn_sensitivity     10
joystick_y_axis               1
joystick_y_invert             0
joystick_strafe_axis          0
joystick_strafe_invert        0
joystick_move_sensitivity     10
joystick_look_axis            3
joystick_look_invert          0
joystick_look_sensitivity     10
joystick_physical_button0     22
joystick_physical_button1     21
joystick_physical_button2     1
joystick_physical_button3     0
joystick_physical_button4     9
joystick_physical_button5     10
joystick_physical_button6     6
joystick_physical_button7     3
joystick_physical_button8     2
joystick_physical_button9     13
joystick_physical_button10    14
joystick_physical_button11    11
joystick_physical_button12    12
joystick_physical_button13    7
joystick_physical_button14    14
joystick_physical_button15    15
joystick_physical_button16    16
use_gamepad                   1
gamepad_type                  0
joystick_x_dead_zone          33
joystick_y_dead_zone          33
joystick_strafe_dead_zone     33
joystick_look_dead_zone       33
joyb_strafeleft               -1
joyb_straferight              -1
joyb_menu_activate            6
joyb_toggle_automap           7
joyb_prevweapon               4
joyb_nextweapon               5
key_pause                     69
key_menu_activate             1
key_menu_up                   72
key_menu_down                 80
key_menu_left                 75
key_menu_right                77
key_menu_back                 14
key_menu_forward              28
key_menu_confirm              21
key_menu_abort                49
key_menu_help                 59
key_menu_save                 60
key_menu_load                 61
key_menu_volume               62
key_menu_detail               63
key_menu_qsave                64
key_menu_endgame              65
key_menu_messages             66
key_menu_qload                67
key_menu_quit                 68
key_menu_gamma                87
key_spy                       88
key_menu_nextlevel            0
key_menu_reloadlevel          0
key_menu_incscreen            13
key_menu_decscreen            12
key_menu_screenshot           0
key_menu_cleanscreenshot      0
key_menu_del                  83
key_map_toggle                15
key_map_north                 72
key_map_south                 80
key_map_east                  77
key_map_west                  75
key_map_zoomin                13
key_map_zoomout               12
key_map_maxzoom               11
key_map_follow                33
key_map_grid                  34
key_map_mark                  50
key_map_clearmark             46
key_map_overlay               24
key_map_rotate                19
mouseb_mapzoomin              3
mouseb_mapzoomout             4
mouseb_mapmaxzoom             -1
mouseb_mapfollow              -1
key_weapon1                   2
key_weapon2                   3
key_weapon3                   4
key_weapon4                   5
key_weapon5                   6
key_weapon6                   7
key_weapon7                   8
key_weapon8                   9
key_prevweapon                0
key_nextweapon                0
key_message_refresh           28
key_demo_quit                 16
key_multi_msg                 20
key_multi_msgplayer1          34
key_multi_msgplayer2          23
key_multi_msgplayer3          48
key_multi_msgplayer4          19
key_reverse                   0
key_toggleautorun             58
key_togglenovert              0
mouse_y_invert                0
crispy_automapoverlay         0
crispy_automaprotate          0
crispy_automapstats           0
crispy_bobfactor              0
crispy_btusetimer             0
crispy_brightmaps             0
crispy_centerweapon           0
crispy_coloredblood           0
crispy_coloredhud             0
crispy_crosshair              0
crispy_crosshairhealth        0
crispy_crosshairtarget        0
crispy_crosshairtype          0
crispy_defaultskill           0
crispy_demobar                0
crispy_demotimer              0
crispy_demotimerdir           0
crispy_extautomap             1
crispy_flipcorpses            0
crispy_fpslimit               0
crispy_freeaim                0
crispy_freelook               0
crispy_gamma                  9
crispy_hires                  1
crispy_jump                   0
crispy_leveltime              0
crispy_mouselook              0
crispy_neghealth              0
crispy_overunder              0
crispy_pitch                  0
crispy_playercoords           0
crispy_secretmessage          0
crispy_smoothlight            0
crispy_smoothmap              0
crispy_soundfix               1
crispy_soundfull              0
crispy_soundmono              0
crispy_statsformat            0
crispy_translucency           0
crispy_uncapped               0
crispy_vsync                  1
crispy_widescreen             1
EOF
cat << EOF > $SYS_DIR/default.cfg
mouse_sensitivity             5
mouse_sensitivity_x2          5
mouse_sensitivity_y           5
sfx_volume                    8
music_volume                  8
show_messages                 1
key_right                     77
key_left                      75
key_up                        72
key_down                      80
key_alt_up                    17
key_alt_down                  31
key_strafeleft                51
key_alt_strafeleft            30
key_straferight               52
key_alt_straferight           32
key_jump                      53
key_lookup                    81
key_lookdown                  83
key_lookcenter                79
key_fire                      29
key_use                       57
key_strafe                    56
key_speed                     54
key_demospeed                 78
use_mouse                     1
mouseb_fire                   0
mouseb_strafe                 1
mouseb_forward                2
mouseb_speed                  3
mouseb_jump                   -1
mouseb_mouselook              -1
mouseb_reverse                -1
use_joystick                  1
joyb_fire                     0
joyb_strafe                   -1
joyb_use                      2
joyb_speed                    1
joyb_jump                     3
screenblocks                  10
detaillevel                   0
snd_channels                  8
snd_musicdevice               3
snd_sfxdevice                 3
snd_sbport                    0
snd_sbirq                     0
snd_sbdma                     0
snd_mport                     0
usegamma                      0
chatmacro0                    "No"
chatmacro1                    "I'm ready to kick butt!"
chatmacro2                    "I'm OK."
chatmacro3                    "I'm not looking too good!"
chatmacro4                    "Help!"
chatmacro5                    "You suck!"
chatmacro6                    "Next time, scumbag..."
chatmacro7                    "Come here!"
chatmacro8                    "I'll take care of it."
chatmacro9                    "Yes"
EOF

# Create additional required symlinks
ln -sr $APPDIR/io.playstratus.freedoom.png $APPDIR/.DirIcon
ln -sr $BIN_DIR/freedoom $APPDIR/AppRun

# Build appimage
DEFAULT_DEST="$(dirname "$0")/build/freedoom"
ARCH=x86_64 appimagetool $APPDIR "${1:-$DEFAULT_DEST}"
