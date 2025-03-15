{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell{
  packages = [
    pkgs.nodejs
    pkgs.python3
    pkgs.ninja
  ];
  shellHook = ''
    export SHELL=$(which zsh)
    nvim && exit
  '';
}
